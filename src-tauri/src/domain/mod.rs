use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ManuscriptNode {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub r#type: String, // 'part', 'chapter', 'scene', 'folder'
    pub sort_order: i32,
    pub status: String, // 'draft', 'review', 'final'
    pub color: Option<String>,
    pub tags: Option<String>,
    pub synopsis: Option<String>,
    pub writing_goals: Option<String>,
    pub author_notes: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}
