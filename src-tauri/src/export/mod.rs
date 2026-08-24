pub mod html;
pub mod markdown;
pub mod docx;
pub mod pdf;
pub mod txt;
pub mod utils;

pub use utils::html_to_plain_text;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ExportChapter {
    pub title: String,
    pub scenes: Vec<ExportScene>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExportScene {
    pub id: String,
    pub title: String,
    pub content: String, // plain text
    pub synopsis: Option<String>,
    pub author_notes: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExportPart {
    pub title: String,
    pub chapters: Vec<ExportChapter>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExportManuscript {
    pub title: String,
    pub author: Option<String>,
    pub parts: Vec<ExportPart>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExportOptions {
    pub include_scene_titles: bool,
    pub include_synopsis: bool,
    pub include_author_notes: bool,
    pub include_chapter_titles: bool,
    pub include_part_titles: bool,
}

impl Default for ExportOptions {
    fn default() -> Self {
        Self {
            include_scene_titles: true,
            include_synopsis: false,
            include_author_notes: false,
            include_chapter_titles: true,
            include_part_titles: true,
        }
    }
}

pub fn export_as_html(manuscript: &ExportManuscript) -> String {
    html::generate(manuscript)
}

pub fn export_as_markdown(manuscript: &ExportManuscript) -> String {
    markdown::generate(manuscript)
}

pub fn export_as_docx(manuscript: &ExportManuscript) -> Vec<u8> {
    docx::generate(manuscript)
}

pub fn export_as_pdf(manuscript: &ExportManuscript) -> Vec<u8> {
    pdf::generate(manuscript)
}

pub fn export_as_txt(manuscript: &ExportManuscript) -> String {
    txt::generate(manuscript)
}

pub fn export_preview_as_html(manuscript: &ExportManuscript, options: &ExportOptions) -> String {
    html::generate_with_options(manuscript, options)
}

pub fn export_preview_as_markdown(manuscript: &ExportManuscript, options: &ExportOptions) -> String {
    markdown::generate_with_options(manuscript, options)
}

pub fn export_preview_as_txt(manuscript: &ExportManuscript, options: &ExportOptions) -> String {
    txt::generate_with_options(manuscript, options)
}
