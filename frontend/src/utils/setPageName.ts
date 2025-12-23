// Utility function for change the current page title
export const setPageName = (pageName: string) => {
  const newPageName = `${pageName} - Folderlan`

  // Try to find existing title tag
  const titleTag = document.querySelector('title')

  // Update existing meta tag if found
  if (titleTag instanceof HTMLTitleElement) {
    titleTag.innerText = newPageName
    return
  }

  // Create new title tag if one doesn't exist
  const newTitleTag = document.createElement('title')
  newTitleTag.innerText = newPageName
  document.head.appendChild(newTitleTag)
}
