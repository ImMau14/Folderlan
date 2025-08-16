use regex::Regex;
use std::error::Error;
use std::fs;

/// Read a SQL-like file and return a Vec of top-level statements (strings).
/// - Removes single-line (`-- ...`) and multi-line (`/* ... */`) comments.
/// - Preserves quoted literals ('', "") and bracket-quoted identifiers (`[...]`).
/// - Treats semicolons at block level 0 as statement terminators.
/// - Tracks `begin`/`end` to avoid splitting inside blocks.
pub fn get_array_of_sentences(file_path: &str) -> Result<Vec<String>, Box<dyn Error>> {
    // load file and strip optional UTF-8 BOM (U+FEFF)
    let mut content = fs::read_to_string(file_path)?;
    content = content.trim_start_matches('\u{FEFF}').to_string();

    // regex to remove SQL-style single-line comments (from -- to end-of-line)
    let single_line_comment_re = Regex::new(r"(?m)--[^\n\r]*")?;
    // regex to remove C-style multi-line comments (including newlines)
    let multi_line_comment_re = Regex::new(r"(?s)/\*.*?\*/")?;

    // remove comments in two passes: single-line first, then multi-line
    let content_no_single_comments = single_line_comment_re.replace_all(&content, "");
    let content_no_comments = multi_line_comment_re.replace_all(&content_no_single_comments, "");
    let content = content_no_comments.into_owned();

    // prepared buffers and iterators
    let mut stmts: Vec<String> = Vec::new();                 // collected statements
    let mut buf = String::with_capacity(content.len());      // accumulates chars for current statement
    let mut token_buf = String::new();                       // accumulates letters to detect keywords (begin/end)
    let mut chars = content.chars().peekable();

    // parsing state flags
    let mut in_single = false;   // inside single-quoted literal (')
    let mut in_double = false;   // inside double-quoted literal (")
    let mut in_bracket = false;  // inside bracket-quoted identifier ([...])
    let mut block_level: i32 = 0; // nesting level for begin/end blocks

    // streaming character-by-character state machine
    while let Some(ch) = chars.next() {
        buf.push(ch);

        // If inside single-quoted literal: handle escaped '' and closing '
        if in_single {
            if ch == '\'' {
                // SQL-style escaping: two consecutive single quotes represent one quote inside literal
                if let Some(&'\'') = chars.peek() {
                    buf.push(chars.next().unwrap()); // consume escaped quote
                    continue;
                } else {
                    in_single = false; // end of single-quoted literal
                }
            }
            continue; // keep consuming literal characters
        }

        // If inside double-quoted literal: handle escaped "" and closing "
        if in_double {
            if ch == '"' {
                if let Some(&'"') = chars.peek() {
                    buf.push(chars.next().unwrap()); // consume escaped double-quote
                    continue;
                } else {
                    in_double = false; // end of double-quoted literal
                }
            }
            continue;
        }

        // If inside bracket-quoted identifier, close only on ]
        if in_bracket {
            if ch == ']' {
                in_bracket = false;
            }
            continue;
        }

        // Not inside any quote/bracket: interpret structural characters and keywords
        match ch {
            '\'' => {
                // entering single-quoted literal; finalize any token buffer (keyword detection)
                in_single = true;
                if !token_buf.is_empty() {
                    check_begin_end_and_clear(&mut token_buf, &mut block_level);
                }
            }
            '"' => {
                // entering double-quoted literal
                in_double = true;
                if !token_buf.is_empty() {
                    check_begin_end_and_clear(&mut token_buf, &mut block_level);
                }
            }
            '[' => {
                // entering bracket-quoted identifier (e.g., [Column Name])
                in_bracket = true;
                if !token_buf.is_empty() {
                    check_begin_end_and_clear(&mut token_buf, &mut block_level);
                }
            }
            ';' => {
                // semicolon ends a statement only when not inside a begin/end block
                if block_level == 0 {
                    let stmt = buf.trim();
                    let stmt = stmt.trim_end_matches(';').trim(); // remove trailing semicolon + whitespace
                    if !stmt.is_empty() {
                        stmts.push(stmt.to_string());
                    }
                    buf.clear();
                    token_buf.clear();
                    continue;
                } else {
                    // semicolon inside a block - treat as data; still update keyword tracking
                    if !token_buf.is_empty() {
                        check_begin_end_and_clear(&mut token_buf, &mut block_level);
                    }
                }
            }
            c if c.is_ascii_alphabetic() => {
                // collect letters to form tokens (keywords); use lowercase to simplify matching
                token_buf.push(c.to_ascii_lowercase());
            }
            _ => {
                // any non-letter separates tokens; check the current token for begin/end
                if !token_buf.is_empty() {
                    check_begin_end_and_clear(&mut token_buf, &mut block_level);
                }
            }
        }
    }

    // leftover buffered content forms the final statement if not empty
    let tail = buf.trim();
    if !tail.is_empty() {
        stmts.push(tail.to_string());
    }

    // final cleanup: trim each statement and remove empties
    let stmts_clean: Vec<String> = stmts.into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    Ok(stmts_clean)
}

/// Inspect a keyword token (`begin` or `end`) and adjust block nesting.
/// Afterwards clear the token buffer.
fn check_begin_end_and_clear(token_buf: &mut String, block_level: &mut i32) {
    match token_buf.as_str() {
        "begin" => {
            *block_level += 1;
        }
        "end" => {
            if *block_level > 0 {
                *block_level -= 1;
            }
        }
        _ => {}
    }
    token_buf.clear();
}