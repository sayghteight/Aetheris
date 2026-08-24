use std::process::Command;
use std::path::PathBuf;

#[derive(Debug, serde::Serialize)]
pub struct GitTag {
    pub name: String,
    pub hash: String,
    pub date: String,
}

#[derive(Debug, serde::Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
    pub date: String,
}

#[derive(Debug, serde::Serialize)]
pub struct TagInfo {
    pub current_tag: Option<String>,
    pub commits_since_tag: Vec<GitCommit>,
    pub all_tags: Vec<GitTag>,
}

#[tauri::command]
pub fn get_git_tags() -> Result<TagInfo, String> {
    // Get all tags (already sorted by creation date)
    let all_tags = get_all_tags();

    // Derive current_tag from first app-v* tag in the list
    let current_tag = all_tags.iter()
        .find(|t| t.name.starts_with("app-v"))
        .map(|t| t.name.clone());

    // Get the previous app-v* tag to show commits FOR this version
    let prev_tag = all_tags.iter()
        .skip(1) // skip current (first app-v* tag)
        .find(|t| t.name.starts_with("app-v"))
        .map(|t| t.name.clone());

    // Get commits for current version (from prev_tag to current_tag)
    let commits_since_tag = get_commits_between_tags(&prev_tag, &current_tag);

    Ok(TagInfo {
        current_tag,
        commits_since_tag,
        all_tags,
    })
}

fn get_current_tag() -> Option<String> {
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();

    // Try origin/main first
    let _ = Command::new("git")
        .args(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main", "--tags"])
        .current_dir(&repo_root)
        .output();

    let output = Command::new("git")
        .args(["describe", "--tags", "--abbrev=0", "origin/main"])
        .current_dir(&repo_root)
        .output();

    if let Ok(out) = &output {
        if out.status.success() {
            let tag = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !tag.is_empty() {
                return Some(tag);
            }
        }
    }

    // Fallback: most recent tag by creation date from local tags
    let output = Command::new("git")
        .args(["describe", "--tags", "--abbrev=0"])
        .current_dir(&repo_root)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let tag = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if tag.is_empty() { None } else { Some(tag) }
        }
        _ => None,
    }
}

fn get_all_tags() -> Vec<GitTag> {
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();

    // Fetch latest tags and remote branches
    let _ = Command::new("git")
        .args(["fetch", "origin", "--tags"])
        .current_dir(&repo_root)
        .output();

    // Also ensure origin/main is updated
    let _ = Command::new("git")
        .args(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"])
        .current_dir(&repo_root)
        .output();

    let output = Command::new("git")
        .args(["tag", "--sort=-creatordate", "--format=%(refname:short)|%(objectname:short)|%(creatordate:short)"])
        .current_dir(&repo_root)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() >= 3 {
                        Some(GitTag {
                            name: parts[0].to_string(),
                            hash: parts[1].to_string(),
                            date: parts[2].to_string(),
                        })
                    } else {
                        None
                    }
                })
                .collect()
        }
        _ => Vec::new(),
    }
}

fn get_commits_since_tag(tag: &Option<String>) -> Vec<GitCommit> {
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();

    // Ensure origin/main is up to date
    let _ = Command::new("git")
        .args(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"])
        .current_dir(&repo_root)
        .output();

    // Use origin/main as base to get all commits since the tag on the main release branch
    let range = match tag {
        Some(t) => format!("{}..origin/main", t),
        None => "origin/main".to_string(),
    };

    let output = Command::new("git")
        .args([
            "log",
            &range,
            "--no-merges",
            "--format=%H|%s|%ad",
            "--date=short",
        ])
        .current_dir(&repo_root)
        .output();

    match output {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout)
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(3, '|').collect();
                if parts.len() >= 3 {
                    Some(GitCommit {
                        hash: parts[0][..8].to_string(),
                        message: parts[1].to_string(),
                        date: parts[2].to_string(),
                    })
                } else {
                    None
                }
            })
            .collect(),
        _ => Vec::new()
    }
}

fn get_commits_between_tags(from_tag: &Option<String>, to_tag: &Option<String>) -> Vec<GitCommit> {
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf();

    // Ensure origin/main is up to date
    let _ = Command::new("git")
        .args(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"])
        .current_dir(&repo_root)
        .output();

    // Get commits between from_tag (exclusive) and to_tag (inclusive)
    let range = match (from_tag, to_tag) {
        (Some(from), Some(to)) => format!("{}..{}", from, to),
        (None, Some(to)) => format!("{}", to),
        _ => return Vec::new(),
    };

    let output = Command::new("git")
        .args([
            "log",
            &range,
            "--no-merges",
            "--format=%H|%s|%ad",
            "--date=short",
        ])
        .current_dir(&repo_root)
        .output();

    match output {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout)
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(3, '|').collect();
                if parts.len() >= 3 {
                    Some(GitCommit {
                        hash: parts[0][..8].to_string(),
                        message: parts[1].to_string(),
                        date: parts[2].to_string(),
                    })
                } else {
                    None
                }
            })
            .collect(),
        _ => Vec::new()
    }
}
