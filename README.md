# imghoover

A tool to search and download images from Google Images using Playwright.

## Installation

```bash
bun install
```

## Usage

Run the script with a search term:

```bash
bun run search.ts --search "your search term"
```

### Command Line Arguments

- `--search`: (Required) The search term to look for images
- `--headless`: (Optional) Run browser in headless mode (default: true)

## Features

- Searches Google Images for the specified term
- Downloads found images to a `results` directory
- Creates a subdirectory for each search term
- Handles Google consent dialogs automatically
- Images are saved with unique filenames based on their URLs

## Dependencies

- Bun
- Playwright (for browser automation)

## Notes

- Images are saved in the `results` directory, organized by search term
- Each image filename includes an index and a hash of the URL
- The browser will stay open if run in non-headless mode
