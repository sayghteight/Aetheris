use super::ExportManuscript;

pub fn generate(manuscript: &ExportManuscript) -> String {
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
        if pi > 0 {
            html.push_str("    <hr>\n");
        }
        html.push_str("    <h2>");
        html.push_str(&escape_html(&part.title));
        html.push_str("</h2>\n");

        for chapter in &part.chapters {
            html.push_str("        <h3>");
            html.push_str(&escape_html(&chapter.title));
            html.push_str("</h3>\n");

            for scene in &chapter.scenes {
                html.push_str("        <div class=\"scene\">\n");
                html.push_str("            <p class=\"scene-title\">");
                html.push_str(&escape_html(&scene.title));
                html.push_str("</p>\n");
                html.push_str(&format_scene_content(&scene.content));
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
    let paragraphs: Vec<&str> = content.split("\n\n").filter(|p| !p.trim().is_empty()).collect();

    paragraphs
        .iter()
        .map(|p| format!("            <p>{}</p>\n", escape_html(p.trim())))
        .collect()
}
