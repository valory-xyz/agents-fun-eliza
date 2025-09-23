use anyhow::Result;
use rust_embed::RustEmbed;
use std::env;
use std::fs;
use std::io::Write;
use std::process::Command;
use tempfile::tempdir;

#[derive(RustEmbed)]
#[folder = "pkg/"]
struct PkgAssets;

/// Map (OS, ARCH) to the folder name under `pkg/binary/`.
fn os_arch_subfolder() -> Option<&'static str> {
    let os = env::consts::OS; // e.g. "macos", "linux", "windows"
    let arch = env::consts::ARCH; // e.g. "x86_64", "aarch64"
    match (os, arch) {
        ("macos", "aarch64") => Some("macos_arm64"),
        ("macos", "x86_64") => Some("macos_x64"),
        ("linux", "x86_64") => Some("linux_x64"),
        ("linux", "aarch64") => Some("linux_arm64"),
        ("windows", "x86_64") => Some("win_x64"),
        _ => None,
    }
}

fn main() -> Result<()> {
    // 1) Identify the correct subfolder for the current OS & CPU.
    let Some(subfolder) = os_arch_subfolder() else {
        eprintln!(
            "Unsupported platform: {}-{}",
            env::consts::OS,
            env::consts::ARCH
        );
        std::process::exit(1);
    };

    println!(
        "Detected OS={}, ARCH={}. Using subfolder: {}",
        env::consts::OS,
        env::consts::ARCH,
        subfolder
    );

    // 2) Create a temporary directory for extraction.
    let tmp_dir = tempdir()?;
    let tmp_path = tmp_dir.path();

    // 3) Extract everything from `pkg/` into `tmp_path`.
    //    This includes package.json, node_modules, characters/, data/, etc.
    for file in PkgAssets::iter() {
        let data = PkgAssets::get(&file).unwrap();
        let out_path = tmp_path.join(file.as_ref());
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut f = fs::File::create(&out_path)?;
        f.write_all(&data.data)?;
    }

    // 4) Build the path to the binary for this OS CPU.
    let binary_filename = "agent_runner"; // Adjust if yours has a different name
    let node_binary = tmp_path.join("binary").join(binary_filename);

    // 5) On Unix-like systems, mark the binary as executable.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&node_binary)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&node_binary, perms)?;
    }

    // 6) Run the binary with the desired arguments.
    //    Example: ./mybinary.node --character=characters/eliza.character.json
    //    We'll set current_dir to the tmp_path so that relative paths (like `characters/`) resolve.
    let status = Command::new(&node_binary)
        .args(["--character=characters/eliza.character.json"])
        .current_dir(&tmp_path)
        .status()?;

    println!("Binary exited with status: {}", status);
    Ok(())
}
