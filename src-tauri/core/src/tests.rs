use super::*;
use std::io::Cursor;
use tempfile::tempdir;

const FIXTURE: &str = include_str!("../../../docs/fixtures/salon-madrid.json");

/// Construye un ZIP en memoria con las entradas dadas.
fn zip_with(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut w = ZipWriter::new(Cursor::new(Vec::new()));
    for (name, data) in entries {
        if name.ends_with('/') {
            w.add_directory(*name, SimpleFileOptions::default())
                .unwrap();
        } else {
            w.start_file(*name, SimpleFileOptions::default()).unwrap();
            w.write_all(data).unwrap();
        }
    }
    w.finish().unwrap().into_inner()
}

fn read(bytes: Vec<u8>) -> Result<OpenedProject> {
    read_zip(Cursor::new(bytes), Limits::default())
}

#[test]
fn round_trip_planocasa_preserva_json_y_assets() {
    let dir = tempdir().unwrap();
    let src = dir.path().join("origen.planocasa");
    fs::write(
        &src,
        zip_with(&[
            ("project.json", b"{}"),
            ("assets/", b""),
            ("assets/fondo.png", b"\x89PNG..."),
            ("assets/modelos/sofa.glb", b"glTF"),
        ]),
    )
    .unwrap();

    let dst = dir.path().join("salon.planocasa");
    save(&dst, FIXTURE, Some(&src)).unwrap();

    let opened = open(&dst).unwrap();
    assert_eq!(opened.project_json, FIXTURE);
    assert_eq!(opened.assets, vec!["fondo.png", "modelos/sofa.glb"]);

    // Guardar otra vez sobre sí mismo conserva los assets.
    save(&dst, "{\"v\":2}", Some(&dst)).unwrap();
    let again = open(&dst).unwrap();
    assert_eq!(again.project_json, "{\"v\":2}");
    assert_eq!(again.assets, opened.assets);
}

#[test]
fn round_trip_json_plano() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("salon-madrid.json");
    save(&p, FIXTURE, None).unwrap();
    let opened = open(&p).unwrap();
    assert_eq!(opened.project_json, FIXTURE);
    assert!(opened.assets.is_empty());
}

#[test]
fn el_guardado_no_deja_temporales() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("a.planocasa");
    save(&p, "{}", None).unwrap();
    let names: Vec<_> = fs::read_dir(dir.path())
        .unwrap()
        .map(|e| e.unwrap().file_name().into_string().unwrap())
        .collect();
    assert_eq!(names, vec!["a.planocasa"]);
}

#[test]
fn un_guardado_fallido_no_toca_el_original() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("a.planocasa");
    save(&p, "{\"original\":true}", None).unwrap();

    // Origen de assets corrupto: el guardado debe fallar…
    let bad = dir.path().join("roto.planocasa");
    fs::write(&bad, b"esto no es un zip").unwrap();
    assert!(save(&p, "{\"nuevo\":true}", Some(&bad)).is_err());

    // …y el archivo original sigue intacto y sin temporales.
    assert_eq!(open(&p).unwrap().project_json, "{\"original\":true}");
    assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 2);
}

#[test]
fn rechaza_extensiones_desconocidas() {
    let dir = tempdir().unwrap();
    assert!(matches!(
        open(&dir.path().join("x.zip")),
        Err(Error::UnsupportedExtension)
    ));
    assert!(matches!(
        save(&dir.path().join("x"), "{}", None),
        Err(Error::UnsupportedExtension)
    ));
    assert_eq!(
        FileKind::from_path(Path::new("C:\\Git\\Casa.PLANOCASA")).unwrap(),
        FileKind::Planocasa
    );
}

#[test]
fn exige_project_json() {
    assert!(matches!(
        read(zip_with(&[("assets/a.png", b"x")])),
        Err(Error::MissingProjectJson)
    ));
}

#[test]
fn exige_utf8() {
    assert!(matches!(
        read(zip_with(&[("project.json", &[0xff, 0xfe, 0x00])])),
        Err(Error::NotUtf8)
    ));
}

#[test]
fn bloquea_zip_slip_y_entradas_extranas() {
    for bad in [
        "../fuera.txt",
        "assets/../../fuera.txt",
        "/etc/passwd",
        "assets/C:/windows.txt",
        "assets/a\\..\\b",
        "otra/cosa.txt",
        "malware.exe",
    ] {
        let r = read(zip_with(&[("project.json", b"{}"), (bad, b"x")]));
        assert!(
            matches!(r, Err(Error::UnsafeEntry(_))),
            "debería bloquear {bad}"
        );
    }
    let r = read(zip_with(&[("project.json", b"{}"), ("otra/", b"")]));
    assert!(matches!(r, Err(Error::UnsafeEntry(_))));
}

#[test]
fn respeta_los_limites() {
    let tiny = Limits {
        max_project_json: 4,
        max_asset: 4,
        max_total: 100,
        max_entries: 3,
    };
    let big_json = zip_with(&[("project.json", b"{\"a\":1}")]);
    assert!(matches!(
        read_zip(Cursor::new(big_json), tiny),
        Err(Error::TooLarge(_))
    ));

    let big_asset = zip_with(&[("project.json", b"{}"), ("assets/a", b"12345")]);
    assert!(matches!(
        read_zip(Cursor::new(big_asset), tiny),
        Err(Error::TooLarge(_))
    ));

    let many = zip_with(&[
        ("project.json", b"{}"),
        ("assets/a", b"1"),
        ("assets/b", b"1"),
        ("assets/c", b"1"),
    ]);
    assert!(matches!(
        read_zip(Cursor::new(many), tiny),
        Err(Error::TooLarge(_))
    ));

    let dir = tempdir().unwrap();
    let p = dir.path().join("grande.json");
    fs::write(&p, b"{\"a\":1}").unwrap();
    assert!(matches!(
        open_with_limits(&p, tiny),
        Err(Error::TooLarge(_))
    ));
}

#[test]
fn nombres_de_assets() {
    for ok in ["fondo.png", "modelos/sofa.glb", "a b.jpg", "ñandú.pdf"] {
        assert!(is_safe_asset_name(ok), "{ok}");
    }
    for ko in [
        "", "/abs", "a/../b", "./a", "a//b", "a\\b", "C:x", "a\u{0}b", "a/",
    ] {
        assert!(!is_safe_asset_name(ko), "{ko:?}");
    }
}
