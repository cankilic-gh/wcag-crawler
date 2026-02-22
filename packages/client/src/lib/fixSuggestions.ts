// Before/After fix examples for common axe-core rules

export interface FixSuggestion {
  ruleId: string;
  problem: string;
  solution: string;
  before: string;
  after: string;
}

export const FIX_SUGGESTIONS: Record<string, FixSuggestion> = {
  'region': {
    ruleId: 'region',
    problem: 'Content is not inside a landmark region (header, nav, main, footer, etc.)',
    solution: 'Wrap the content inside a semantic landmark element like <main>, <header>, <nav>, <aside>, or <footer>',
    before: `<body>
  <div class="container">
    <p>Page content here...</p>
  </div>
</body>`,
    after: `<body>
  <main class="container">
    <p>Page content here...</p>
  </main>
</body>`,
  },

  'landmark-one-main': {
    ruleId: 'landmark-one-main',
    problem: 'Page does not have a <main> landmark',
    solution: 'Add a <main> element to wrap the primary content of the page',
    before: `<body>
  <div class="content">
    <h1>Welcome</h1>
    <p>Main content...</p>
  </div>
</body>`,
    after: `<body>
  <main class="content">
    <h1>Welcome</h1>
    <p>Main content...</p>
  </main>
</body>`,
  },

  'heading-order': {
    ruleId: 'heading-order',
    problem: 'Heading levels are skipped (e.g., h1 to h3 without h2)',
    solution: 'Use heading levels in sequential order without skipping levels',
    before: `<h1>Page Title</h1>
<h3>Subsection</h3>  <!-- Skipped h2! -->
<p>Content...</p>`,
    after: `<h1>Page Title</h1>
<h2>Subsection</h2>  <!-- Correct order -->
<p>Content...</p>`,
  },

  'select-name': {
    ruleId: 'select-name',
    problem: 'Select element does not have an accessible name',
    solution: 'Add a <label> element associated with the select, or use aria-label',
    before: `<select name="country">
  <option>USA</option>
  <option>Canada</option>
</select>`,
    after: `<label for="country">Country</label>
<select id="country" name="country">
  <option>USA</option>
  <option>Canada</option>
</select>

<!-- Or use aria-label -->
<select name="country" aria-label="Select your country">
  <option>USA</option>
</select>`,
  },

  'image-alt': {
    ruleId: 'image-alt',
    problem: 'Image does not have an alt attribute',
    solution: 'Add an alt attribute describing the image, or alt="" for decorative images',
    before: `<img src="logo.png">`,
    after: `<!-- Informative image -->
<img src="logo.png" alt="Company Logo">

<!-- Decorative image -->
<img src="decoration.png" alt="">`,
  },

  'link-name': {
    ruleId: 'link-name',
    problem: 'Link does not have discernible text',
    solution: 'Add text content, aria-label, or an image with alt text inside the link',
    before: `<a href="/profile">
  <i class="icon-user"></i>
</a>`,
    after: `<a href="/profile" aria-label="View profile">
  <i class="icon-user" aria-hidden="true"></i>
</a>

<!-- Or with visible text -->
<a href="/profile">
  <i class="icon-user" aria-hidden="true"></i>
  <span>Profile</span>
</a>`,
  },

  'button-name': {
    ruleId: 'button-name',
    problem: 'Button does not have discernible text',
    solution: 'Add text content or aria-label to the button',
    before: `<button type="submit">
  <i class="icon-search"></i>
</button>`,
    after: `<button type="submit" aria-label="Search">
  <i class="icon-search" aria-hidden="true"></i>
</button>

<!-- Or with visible text -->
<button type="submit">
  <i class="icon-search" aria-hidden="true"></i>
  Search
</button>`,
  },

  'color-contrast': {
    ruleId: 'color-contrast',
    problem: 'Text color does not have sufficient contrast with background',
    solution: 'Increase contrast ratio to at least 4.5:1 for normal text, 3:1 for large text',
    before: `<p style="color: #999; background: #fff;">
  Light gray text on white
</p>`,
    after: `<p style="color: #595959; background: #fff;">
  Darker gray text on white (4.5:1 ratio)
</p>`,
  },

  'label': {
    ruleId: 'label',
    problem: 'Form input does not have an associated label',
    solution: 'Add a <label> element with for attribute matching the input id',
    before: `<input type="text" name="email" placeholder="Email">`,
    after: `<label for="email">Email Address</label>
<input type="text" id="email" name="email">`,
  },

  'duplicate-id': {
    ruleId: 'duplicate-id',
    problem: 'Multiple elements have the same id attribute',
    solution: 'Ensure each id is unique within the page',
    before: `<div id="content">First</div>
<div id="content">Second</div>`,
    after: `<div id="content-1">First</div>
<div id="content-2">Second</div>`,
  },

  'html-has-lang': {
    ruleId: 'html-has-lang',
    problem: 'The <html> element does not have a lang attribute',
    solution: 'Add a lang attribute to the <html> element',
    before: `<html>
  <head>...</head>
</html>`,
    after: `<html lang="en">
  <head>...</head>
</html>`,
  },

  'bypass': {
    ruleId: 'bypass',
    problem: 'Page does not have a skip link to bypass repeated content',
    solution: 'Add a "Skip to main content" link at the top of the page',
    before: `<body>
  <nav>Long navigation...</nav>
  <main id="main">Content</main>
</body>`,
    after: `<body>
  <a href="#main" class="skip-link">
    Skip to main content
  </a>
  <nav>Long navigation...</nav>
  <main id="main">Content</main>
</body>`,
  },

  'aria-hidden-focus': {
    ruleId: 'aria-hidden-focus',
    problem: 'Focusable element is inside an aria-hidden container',
    solution: 'Remove aria-hidden from parent, or add tabindex="-1" to focusable elements',
    before: `<div aria-hidden="true">
  <button>Click me</button>
</div>`,
    after: `<div aria-hidden="true">
  <button tabindex="-1">Click me</button>
</div>

<!-- Or remove aria-hidden if content should be accessible -->
<div>
  <button>Click me</button>
</div>`,
  },

  'meta-viewport': {
    ruleId: 'meta-viewport',
    problem: 'Viewport meta prevents user scaling',
    solution: 'Remove user-scalable=no and maximum-scale restrictions',
    before: `<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, maximum-scale=1">`,
    after: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  },

  'tabindex': {
    ruleId: 'tabindex',
    problem: 'Element has a tabindex value greater than 0',
    solution: 'Use tabindex="0" for focusable elements or "-1" for programmatic focus only',
    before: `<div tabindex="5">Custom widget</div>`,
    after: `<div tabindex="0">Custom widget</div>`,
  },

  'empty-heading': {
    ruleId: 'empty-heading',
    problem: 'Heading element is empty',
    solution: 'Add text content to the heading or remove it if not needed',
    before: `<h2></h2>
<h2><span class="icon"></span></h2>`,
    after: `<h2>Section Title</h2>
<h2>
  <span class="icon" aria-hidden="true"></span>
  Section Title
</h2>`,
  },

  'frame-title': {
    ruleId: 'frame-title',
    problem: 'iframe does not have a title attribute',
    solution: 'Add a title attribute describing the iframe content',
    before: `<iframe src="video.html"></iframe>`,
    after: `<iframe src="video.html" title="Product demo video"></iframe>`,
  },

  'input-button-name': {
    ruleId: 'input-button-name',
    problem: 'Input button does not have discernible text',
    solution: 'Add a value attribute for the button text',
    before: `<input type="submit">
<input type="button">`,
    after: `<input type="submit" value="Submit Form">
<input type="button" value="Cancel">`,
  },

  'document-title': {
    ruleId: 'document-title',
    problem: 'Document does not have a <title> element',
    solution: 'Add a descriptive <title> element in the <head>',
    before: `<head>
  <meta charset="UTF-8">
</head>`,
    after: `<head>
  <meta charset="UTF-8">
  <title>Page Title - Site Name</title>
</head>`,
  },

  'list': {
    ruleId: 'list',
    problem: 'List element contains non-list item children',
    solution: 'Ensure <ul> and <ol> only contain <li> elements',
    before: `<ul>
  <div>Item 1</div>
  <li>Item 2</li>
</ul>`,
    after: `<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>`,
  },

  'listitem': {
    ruleId: 'listitem',
    problem: '<li> element is not contained in a <ul> or <ol>',
    solution: 'Wrap <li> elements in a <ul> or <ol>',
    before: `<div>
  <li>Item 1</li>
  <li>Item 2</li>
</div>`,
    after: `<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>`,
  },

  'definition-list': {
    ruleId: 'definition-list',
    problem: '<dl> contains non-definition elements',
    solution: 'Ensure <dl> only contains <dt> and <dd> elements',
    before: `<dl>
  <div>
    <dt>Term</dt>
    <dd>Definition</dd>
  </div>
</dl>`,
    after: `<dl>
  <dt>Term</dt>
  <dd>Definition</dd>
</dl>`,
  },

  'nested-interactive': {
    ruleId: 'nested-interactive',
    problem: 'Interactive element is nested inside another interactive element',
    solution: 'Remove nested interactive elements or restructure the markup',
    before: `<button>
  <a href="/link">Click here</a>
</button>`,
    after: `<a href="/link" class="button-style">Click here</a>

<!-- Or separate them -->
<button>Action</button>
<a href="/link">Link</a>`,
  },

  'aria-required-children': {
    ruleId: 'aria-required-children',
    problem: 'ARIA role requires specific child roles',
    solution: 'Add the required child elements with proper ARIA roles',
    before: `<ul role="tablist">
  <li>Tab 1</li>
</ul>`,
    after: `<ul role="tablist">
  <li role="tab">Tab 1</li>
</ul>`,
  },

  'aria-required-parent': {
    ruleId: 'aria-required-parent',
    problem: 'ARIA role requires a specific parent role',
    solution: 'Add the required parent element with proper ARIA role',
    before: `<div>
  <div role="tab">Tab 1</div>
</div>`,
    after: `<div role="tablist">
  <div role="tab">Tab 1</div>
</div>`,
  },
};

export function getFixSuggestion(ruleId: string): FixSuggestion | null {
  return FIX_SUGGESTIONS[ruleId] || null;
}
