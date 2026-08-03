use super::ExportManuscript;

pub fn generate(manuscript: &ExportManuscript) -> String {
    let mut md = String::new();

    // Title
    md.push_str("# ");
    md.push_str(&manuscript.title);
    md.push_str("\n\n");

    // Author
    if let Some(author) = &manuscript.author {
        md.push_str("*");
        md.push_str(author);
        md.push_str("*\n\n");
    }

    md.push_str("---\n\n");

    for (pi, part) in manuscript.parts.iter().enumerate() {
        if pi > 0 {
            md.push_str("\n---\n\n");
        }

        // Part title
        md.push_str("## ");
        md.push_str(&part.title);
        md.push_str("\n\n");

        for chapter in &part.chapters {
            // Chapter title
            md.push_str("### ");
            md.push_str(&chapter.title);
            md.push_str("\n\n");

            for scene in &chapter.scenes {
                // Scene title
                md.push_str("**");
                md.push_str(&scene.title);
                md.push_str("**\n\n");

                // Scene content
                md.push_str(&scene.content);
                md.push_str("\n\n");
            }
        }
    }

    md
}
