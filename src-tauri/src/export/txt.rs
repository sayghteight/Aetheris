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
    let mut output = String::new();

    // Title
    output.push_str(&manuscript.title);
    output.push('\n');

    // Author
    if let Some(author) = &manuscript.author {
        output.push_str(&author);
        output.push('\n');
    }
    output.push_str(&"\n".repeat(3));

    // Parts, chapters, scenes
    for part in &manuscript.parts {
        // Collect chapters/scenes that have content
        let chapters_with_content: Vec<_> = part.chapters.iter()
            .filter(|ch| ch.scenes.iter().any(|s| has_content(s)))
            .collect();

        if chapters_with_content.is_empty() {
            continue;
        }

        if options.include_part_titles {
            output.push_str(&part.title);
            output.push_str("\n\n");
        }

        for chapter in chapters_with_content {
            let scenes_with_content: Vec<_> = chapter.scenes.iter()
                .filter(|s| has_content(s))
                .collect();

            if scenes_with_content.is_empty() {
                continue;
            }

            if options.include_chapter_titles {
                output.push_str(&chapter.title);
                output.push_str("\n\n");
            }

            for scene in scenes_with_content {
                if options.include_scene_titles {
                    output.push_str(&scene.title);
                    output.push('\n');
                }
                output.push_str(&html_to_plain_text(&scene.content));
                output.push_str("\n\n");

                if options.include_synopsis {
                    if let Some(ref synopsis) = scene.synopsis {
                        if !synopsis.trim().is_empty() {
                            output.push_str("[Synopsis: ");
                            output.push_str(synopsis.trim());
                            output.push_str("]\n\n");
                        }
                    }
                }

                if options.include_author_notes {
                    if let Some(ref notes) = scene.author_notes {
                        if !notes.trim().is_empty() {
                            output.push_str("[Nota del autor: ");
                            output.push_str(notes.trim());
                            output.push_str("]\n\n");
                        }
                    }
                }
            }
        }
    }

    output
}
