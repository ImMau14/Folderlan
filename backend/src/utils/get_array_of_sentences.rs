// Parses SQL-like content into individual statements, handling comments, quotes, and block nesting.
use regex::Regex;
use std::error::Error;

/// Extracts top-level SQL statements from input content
/// - Removes single-line (`--`) and multi-line (`/* */`) comments
/// - Preserves quoted literals and bracket identifiers
/// - Tracks BEGIN/END blocks to avoid splitting nested statements
pub fn get_array_of_sentences(content: &'static str) -> Result<Vec<String>, Box<dyn Error>> {
    let content = content.trim_start_matches('\u{FEFF}'); // Remove BOM if present

    // Regex patterns for comment removal
    let single_line_comment_re = Regex::new(r"(?m)--[^\n\r]*")?;
    let multi_line_comment_re = Regex::new(r"(?s)/\*.*?\*/")?;

    // Remove comments in two passes
    let content_no_single_comments = single_line_comment_re.replace_all(content, "");
    let content_no_comments = multi_line_comment_re.replace_all(&content_no_single_comments, "");
    let content = content_no_comments.into_owned();

    // Parsing state tracking
    let mut stmts: Vec<String> = Vec::new();
    let mut buf = String::with_capacity(content.len()); // Current statement buffer
    let mut token_buf = String::new(); // Keyword detection buffer
    let mut chars = content.chars().peekable();

    // State flags for quoted sections and block nesting
    let mut in_single = false; // Inside single quotes
    let mut in_double = false; // Inside double quotes
    let mut in_bracket = false; // Inside brackets
    let mut block_level: i32 = 0; // BEGIN/END nesting depth

    // Main character processing loop
    while let Some(ch) = chars.next() {
        buf.push(ch);

        // Handle single-quoted literals with escape sequences
        if in_single {
            if ch == '\'' {
                if let Some(&'\'') = chars.peek() {
                    buf.push(chars.next().unwrap()); // Consume escaped quote
                    continue;
                } else {
                    in_single = false; // Exit single-quoted section
                }
            }
            continue;
        }

        // Handle double-quoted literals
        if in_double {
            if ch == '"' {
                if let Some(&'"') = chars.peek() {
                    buf.push(chars.next().unwrap());
                    continue;
                } else {
                    in_double = false;
                }
            }
            continue;
        }

        // Handle bracket-quoted identifiers
        if in_bracket {
            if ch == ']' {
                in_bracket = false;
            }
            continue;
        }

        // Process structural characters outside quoted sections
        match ch {
            '\'' => {
                in_single = true;
                if !token_buf.is_empty() {
                    check_begin_end_and_clear(&mut token_buf, &mut block_level);
                }
            }
            '"' => {
                in_double = true;
                if !token_buf.is_empty() {
                    check_begin_end_and_clear(&mut token_buf, &mut block_level);
                }
            }
            '[' => {
                in_bracket = true;
                if !token_buf.is_empty() {
                    check_begin_end_and_clear(&mut token_buf, &mut block_level);
                }
            }
            ';' => {
                // Only split at top-level blocks
                if block_level == 0 {
                    let stmt = buf.trim();
                    let stmt = stmt.trim_end_matches(';').trim();
                    if !stmt.is_empty() {
                        stmts.push(stmt.to_string());
                    }
                    buf.clear();
                    token_buf.clear();
                    continue;
                } else if !token_buf.is_empty() {
                    check_begin_end_and_clear(&mut token_buf, &mut block_level);
                }
            }
            c if c.is_ascii_alphabetic() => {
                token_buf.push(c.to_ascii_lowercase()); // Case-insensitive keyword matching
            }
            _ => {
                if !token_buf.is_empty() {
                    check_begin_end_and_clear(&mut token_buf, &mut block_level);
                }
            }
        }
    }

    // Process any remaining content as final statement
    let tail = buf.trim();
    if !tail.is_empty() {
        stmts.push(tail.to_string());
    }

    // Clean up statements and remove empties
    let stmts_clean: Vec<String> = stmts
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    Ok(stmts_clean)
}

/// Updates block nesting level based on BEGIN/END keywords and clears token buffer
fn check_begin_end_and_clear(token_buf: &mut String, block_level: &mut i32) {
    match token_buf.as_str() {
        "begin" => *block_level += 1,
        "end" => {
            if *block_level > 0 {
                *block_level -= 1;
            }
        }
        _ => {}
    }
    token_buf.clear();
}
