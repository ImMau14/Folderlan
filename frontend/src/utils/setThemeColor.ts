// Utility function for setting the theme color in the browser's meta tag
// Used to dynamically update the theme color of the PWA or mobile browser UI

type hexColor = `#${string}`

// Sets the theme color by updating or creating the theme-color meta tag
export const setThemeColor = (color: hexColor) => {
  // Try to find existing theme-color meta tag
  const themeMetaTag = document.querySelector('meta[name="theme-color"]')

  // Update existing meta tag if found
  if (themeMetaTag instanceof HTMLMetaElement) {
    themeMetaTag.setAttribute("content", color)
    return
  }

  // Create new meta tag if one doesn't exist
  const newThemeMetaTag = document.createElement("meta")
  newThemeMetaTag.name = "theme-color"
  newThemeMetaTag.content = color
  document.head.appendChild(newThemeMetaTag)
}
