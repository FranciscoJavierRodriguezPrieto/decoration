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

// ---------------------------------------------------------------------------
// Assets nuevos, poda y lectura (fase 1: plano de fondo)
// ---------------------------------------------------------------------------

fn staged(entries: &[(&str, &[u8])]) -> BTreeMap<String, Vec<u8>> {
    entries
        .iter()
        .map(|(n, b)| ((*n).to_owned(), b.to_vec()))
        .collect()
}

#[test]
fn guardar_con_assets_nuevos_los_mete_en_el_zip() {
    let dir = tempdir().unwrap();
    let dst = dir.path().join("casa.planocasa");
    let nuevos = staged(&[("fondo-1.pdf", b"%PDF-1.7 ...")]);
    save_with(
        &dst,
        FIXTURE,
        SaveAssets {
            staged: Some(&nuevos),
            ..SaveAssets::default()
        },
    )
    .unwrap();

    assert_eq!(open(&dst).unwrap().assets, vec!["fondo-1.pdf"]);
    assert_eq!(
        read_asset(&dst, "fondo-1.pdf", Limits::default()).unwrap(),
        b"%PDF-1.7 ..."
    );
}

#[test]
fn los_assets_nuevos_sustituyen_a_los_del_origen_y_se_conservan_los_demas() {
    let dir = tempdir().unwrap();
    let src = dir.path().join("origen.planocasa");
    fs::write(
        &src,
        zip_with(&[
            ("project.json", b"{}"),
            ("assets/fondo.png", b"viejo"),
            ("assets/foto.jpg", b"foto"),
        ]),
    )
    .unwrap();
    let nuevos = staged(&[("fondo.png", b"nuevo")]);
    let dst = dir.path().join("casa.planocasa");
    save_with(
        &dst,
        "{}",
        SaveAssets {
            from: Some(&src),
            staged: Some(&nuevos),
            keep: None,
        },
    )
    .unwrap();

    assert_eq!(open(&dst).unwrap().assets, vec!["fondo.png", "foto.jpg"]);
    assert_eq!(
        read_asset(&dst, "fondo.png", Limits::default()).unwrap(),
        b"nuevo"
    );
    assert_eq!(
        read_asset(&dst, "foto.jpg", Limits::default()).unwrap(),
        b"foto"
    );
}

#[test]
fn keep_poda_los_assets_que_el_proyecto_ya_no_usa() {
    let dir = tempdir().unwrap();
    let src = dir.path().join("casa.planocasa");
    fs::write(
        &src,
        zip_with(&[
            ("project.json", b"{}"),
            ("assets/fondo-viejo.pdf", b"%PDF"),
            ("assets/foto.jpg", b"foto"),
        ]),
    )
    .unwrap();
    let nuevos = staged(&[("fondo-nuevo.png", b"png"), ("descartado.png", b"x")]);
    let keep: BTreeSet<String> = ["foto.jpg", "fondo-nuevo.png"]
        .into_iter()
        .map(String::from)
        .collect();

    // Guardar sobre sí mismo (el caso de Ctrl+S).
    save_with(
        &src,
        "{}",
        SaveAssets {
            from: Some(&src),
            staged: Some(&nuevos),
            keep: Some(&keep),
        },
    )
    .unwrap();
    assert_eq!(
        open(&src).unwrap().assets,
        vec!["fondo-nuevo.png", "foto.jpg"]
    );
}

#[test]
fn un_asset_nuevo_con_nombre_peligroso_no_se_guarda() {
    let dir = tempdir().unwrap();
    let dst = dir.path().join("casa.planocasa");
    let malos = staged(&[("../fuera.png", b"x")]);
    let r = save_with(
        &dst,
        "{}",
        SaveAssets {
            staged: Some(&malos),
            ..SaveAssets::default()
        },
    );
    assert!(matches!(r, Err(Error::UnsafeAssetName(_))));
    assert!(!dst.exists(), "no deja archivo a medias");
}

#[test]
fn read_asset_rechaza_nombres_peligrosos_e_inexistentes() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("casa.planocasa");
    fs::write(
        &p,
        zip_with(&[("project.json", b"{}"), ("assets/a.png", b"a")]),
    )
    .unwrap();

    assert!(matches!(
        read_asset(&p, "../project.json", Limits::default()),
        Err(Error::UnsafeAssetName(_))
    ));
    assert!(matches!(
        read_asset(&p, "b.png", Limits::default()),
        Err(Error::AssetNotFound(_))
    ));
    let json = dir.path().join("casa.json");
    fs::write(&json, "{}").unwrap();
    assert!(matches!(
        read_asset(&json, "a.png", Limits::default()),
        Err(Error::AssetNotFound(_))
    ));
}

#[test]
fn read_asset_respeta_el_limite_de_tamano() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("casa.planocasa");
    fs::write(
        &p,
        zip_with(&[("project.json", b"{}"), ("assets/a.png", &[0u8; 64])]),
    )
    .unwrap();
    let limits = Limits {
        max_asset: 16,
        ..Limits::default()
    };
    assert!(read_asset(&p, "a.png", limits).is_err());
}

#[test]
fn el_tipo_del_plano_se_deduce_de_los_bytes() {
    assert_eq!(
        BackgroundKind::sniff(b"%PDF-1.4\n").unwrap(),
        BackgroundKind::Pdf
    );
    assert_eq!(
        BackgroundKind::sniff(b"\x89PNG\r\n\x1a\n....").unwrap(),
        BackgroundKind::Png
    );
    assert_eq!(
        BackgroundKind::sniff(&[0xFF, 0xD8, 0xFF, 0xE0]).unwrap(),
        BackgroundKind::Jpeg
    );
    assert_eq!(
        BackgroundKind::sniff(b"RIFF\0\0\0\0WEBPVP8 ").unwrap(),
        BackgroundKind::Webp
    );
    // Un .exe renombrado a .png no cuela.
    assert!(BackgroundKind::sniff(b"MZ\x90\0").is_err());
    assert!(BackgroundKind::sniff(b"").is_err());
    assert_eq!(BackgroundKind::Jpeg.ext(), "jpg");
    assert!(BackgroundKind::Pdf.is_pdf());
    assert!(!BackgroundKind::Png.is_pdf());
}
