use super::{ExportManuscript, ExportOptions};
use super::html_to_plain_text;

fn has_content(scene: &super::ExportScene) -> bool {
    let text = html_to_plain_text(&scene.content);
    !text.trim().is_empty()
}

pub fn generate(manuscript: &ExportManuscript) -> String {
    generate_with_options(manuscript, &ExportOptions::default())
}

pub fn generate_with_options(manuscript: &ExportManuscript, options: &ExportOptions) -> String {
    let mut html = String::new();

    html.push_str(r#"<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title">"#);
    html.push_str(&escape_html(&manuscript.title));
    html.push_str(r#"</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Georgia, 'Times New Roman', serif;
            line-height: 1.8;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #1a1a1a;
            background: #fefefe;
        }
        h1 {
            font-size: 2.5rem;
            text-align: center;
            margin-bottom: 0.5rem;
        }
        .author {
            text-align: center;
            font-style: italic;
            color: #666;
            margin-bottom: 3rem;
        }
        h2 {
            font-size: 1.8rem;
            margin-top: 2.5rem;
            margin-bottom: 1rem;
            color: #2c2c2c;
        }
        h3 {
            font-size: 1.3rem;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            color: #3a3a3a;
        }
        .scene {
            margin-bottom: 1.5rem;
        }
        .scene-title {
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        .synopsis {
            font-style: italic;
            color: #666;
            margin-bottom: 0.75rem;
            padding-left: 1em;
        }
        .author-notes {
            color: #888;
            font-size: 0.9em;
            margin-top: 0.75rem;
            padding: 0.5em 1em;
            background: #f5f5f5;
            border-left: 3px solid #ccc;
        }
        p { margin-bottom: 1rem; text-indent: 1.5em; }
        p:first-of-type { text-indent: 0; }
        hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
        .chapter-break { text-align: center; margin: 2rem 0; color: #999; }
    </style>
</head>
<body>
"#);

    html.push_str("    <h1>");
    html.push_str(&escape_html(&manuscript.title));
    html.push_str("</h1>\n");

    if let Some(author) = &manuscript.author {
        html.push_str("    <p class=\"author\">");
        html.push_str(&escape_html(author));
        html.push_str("</p>\n");
    }

    for (pi, part) in manuscript.parts.iter().enumerate() {
        // Collect chapters with content
        let chapters_with_content: Vec<_> = part.chapters.iter()
            .filter(|ch| ch.scenes.iter().any(|s| has_content(s)))
            .collect();

        if chapters_with_content.is_empty() {
            continue;
        }

        if pi > 0 {
            html.push_str("    <hr>\n");
        }

        if options.include_part_titles {
            html.push_str("    <h2>");
            html.push_str(&escape_html(&part.title));
            html.push_str("</h2>\n");
        }

        for chapter in chapters_with_content {
            if options.include_chapter_titles {
                html.push_str("        <h3>");
                html.push_str(&escape_html(&chapter.title));
                html.push_str("</h3>\n");
            }

            for scene in chapter.scenes.iter().filter(|s| has_content(s)) {
                html.push_str("        <div class=\"scene\">\n");

                if options.include_scene_titles {
                    html.push_str("            <p class=\"scene-title\">");
                    html.push_str(&escape_html(&scene.title));
                    html.push_str("</p>\n");
                }

                if options.include_synopsis {
                    if let Some(ref synopsis) = scene.synopsis {
                        if !synopsis.trim().is_empty() {
                            html.push_str("            <p class=\"synopsis\">");
                            html.push_str(&escape_html(synopsis.trim()));
                            html.push_str("</p>\n");
                        }
                    }
                }

                html.push_str(&format_scene_content(&scene.content));

                if options.include_author_notes {
                    if let Some(ref notes) = scene.author_notes {
                        if !notes.trim().is_empty() {
                            html.push_str("            <div class=\"author-notes\">\n");
                            html.push_str("                <strong>Nota del autor:</strong> ");
                            html.push_str(&escape_html(notes.trim()));
                            html.push_str("\n            </div>\n");
                        }
                    }
                }

                html.push_str("        </div>\n");
            }
        }
    }

    html.push_str("</body>\n</html>");
    html
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn format_scene_content(content: &str) -> String {
    // Si el contenido ya es HTML (de Tiptap), limpiarlo ligeramente y devolverlo
    // Si es texto plano con saltos de línea, envolver en <p>
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // Si contiene etiquetas HTML al inicio, asumimos que es HTML de Tiptap
    if trimmed.starts_with('<') {
        // Convertir <br> en separadores de párrafo y envolver accordingly
        let with_paragraphs = trimmed
            .replace("&nbsp;", " ")
            .replace("\u{00A0}", " ")
            .replace("<br>", "\n")
            .replace("<br/>", "\n")
            .replace("<br />", "\n");
        let paragraphs: Vec<&str> = with_paragraphs
            .split('\n')
            .filter(|p| !p.trim().is_empty())
            .collect();

        paragraphs
            .iter()
            .map(|p| {
                let p = p.trim();
                if p.starts_with('<') {
                    // Ya es HTML (probablemente <p>...</p>), devolverlo indentado
                    format!("            {}\n", p)
                } else {
                    format!("            <p>{}</p>\n", escape_html(p))
                }
            })
            .collect()
    } else {
        // Texto plano — separar por saltos de línea dobles
        let paragraphs: Vec<&str> = trimmed.split("\n\n").filter(|p| !p.trim().is_empty()).collect();
        paragraphs
            .iter()
            .map(|p| format!("            <p>{}</p>\n", escape_html(p.trim())))
            .collect()
    }
}
