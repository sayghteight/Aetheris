/// Converts HTML from Tiptap to plain text, stripping all tags
/// and preserving paragraph breaks
pub fn html_to_plain_text(html: &str) -> String {
    // Normalize line breaks first
    let normalized = html
        .replace("&nbsp;", " ")
        .replace("\u{00A0}", " ")  // Non-breaking space character
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("</p>", "\n\n")
        .replace("<p>", "");

    // Strip all remaining HTML tags
    let mut result = String::new();
    let mut in_tag = false;
    for ch in normalized.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }

    // Clean up extra whitespace and normalize paragraph breaks
    let lines: Vec<&str> = result.split('\n').collect();
    lines
        .iter()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim())
        .collect::<Vec<_>>()
        .join("\n\n")
}
