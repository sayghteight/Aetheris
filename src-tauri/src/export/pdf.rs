use super::ExportManuscript;
use super::html_to_plain_text;
use printpdf::*;
use std::io::BufWriter;

fn has_content(scene: &super::ExportScene) -> bool {
    let text = html_to_plain_text(&scene.content);
    !text.trim().is_empty()
}

pub fn generate(manuscript: &ExportManuscript) -> Vec<u8> {
    let (doc, page1, layer1) = PdfDocument::new(
        &manuscript.title,
        Mm(210.0),  // A4 width
        Mm(297.0),  // A4 height
        "Layer 1",
    );

    let current_layer = doc.get_page(page1).get_layer(layer1);

    // Use a built-in font
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).unwrap();
    let font_bold = doc.add_builtin_font(BuiltinFont::HelveticaBold).unwrap();

    let mut y_position = 277.0; // Start from top (A4 height in mm)
    let left_margin = 20.0;
    let line_height = 5.0;
    let paragraph_spacing = 8.0;

    // Title
    current_layer.use_text(&manuscript.title, 24.0, Mm(left_margin), Mm(y_position), &font_bold);
    y_position -= 10.0;

    // Author
    if let Some(author) = &manuscript.author {
        current_layer.use_text(author, 12.0, Mm(left_margin), Mm(y_position), &font);
        y_position -= 8.0;
    }

    y_position -= 10.0;

    for (pi, part) in manuscript.parts.iter().enumerate() {
        // Collect chapters with content
        let chapters_with_content: Vec<_> = part.chapters.iter()
            .filter(|ch| ch.scenes.iter().any(|s| has_content(s)))
            .collect();

        if chapters_with_content.is_empty() {
            continue;
        }

        if pi > 0 {
            y_position -= 5.0;
            if y_position < 30.0 {
                // Would need new page - for now just continue
            }
        }

        // Part title
        current_layer.use_text(&part.title, 18.0, Mm(left_margin), Mm(y_position), &font_bold);
        y_position -= 8.0;

        for chapter in chapters_with_content {
            // Chapter title
            current_layer.use_text(&chapter.title, 14.0, Mm(left_margin), Mm(y_position), &font_bold);
            y_position -= 6.0;

            for scene in chapter.scenes.iter().filter(|s| has_content(s)) {
                // Scene title
                current_layer.use_text(&scene.title, 11.0, Mm(left_margin + 5.0), Mm(y_position), &font);
                y_position -= line_height;

                // Scene content - split into lines
                let lines = wrap_text(&scene.content, 70);
                for line in lines {
                    if y_position < 20.0 {
                        y_position = 277.0; // Reset for simplicity
                    }
                    current_layer.use_text(line, 10.0, Mm(left_margin + 5.0), Mm(y_position), &font);
                    y_position -= line_height;
                }
                y_position -= paragraph_spacing;
            }
        }
    }

    let mut buffer = BufWriter::new(Vec::new());
    doc.save(&mut buffer).unwrap();
    buffer.into_inner().unwrap()
}

fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    // Convert HTML to plain text using shared utility
    let plain = html_to_plain_text(text);
    let mut lines = Vec::new();
    for para in plain.split("\n\n") {
        let words: Vec<&str> = para.split_whitespace().collect();
        let mut current_line = String::new();

        for word in words {
            if current_line.len() + word.len() + 1 > max_chars {
                if !current_line.is_empty() {
                    lines.push(current_line.clone());
                    current_line.clear();
                }
            }
            if !current_line.is_empty() {
                current_line.push(' ');
            }
            current_line.push_str(word);
        }
        if !current_line.is_empty() {
            lines.push(current_line);
        }
    }
    lines
}
