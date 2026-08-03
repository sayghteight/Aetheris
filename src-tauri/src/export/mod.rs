pub mod html;
pub mod markdown;
pub mod docx;
pub mod pdf;

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
