mod common;
use common::{TestApp, VisitorOptions};
use std::time::Duration;

#[tokio::test]
async fn test_get_accessible_files_permissions() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    // Create owner
    app.create_owner_direct("owner", "ownerpass").await;
    let owner_token = app.login_and_get_token("owner", "ownerpass").await;

    // Create visitors via API as owner
    let opts = VisitorOptions {
        can_upload: true,
        can_delete_own_files: true,
        has_upload_limits: false,
        upload_limit: 0,
    };

    app.create_visitor_via_api_as_owner(&owner_token, "alice", "alicepass", opts.clone())
        .await;
    app.create_visitor_via_api_as_owner(&owner_token, "bob", "bobpass", opts)
        .await;

    // Login visitors
    let alice_token = app.login_and_get_token("alice", "alicepass").await;
    let bob_token = app.login_and_get_token("bob", "bobpass").await;

    // Find user ids
    let alice_id = app
        .find_user_id_by_username(&owner_token, "alice")
        .await
        .expect("find_user_id_by_username failed")
        .expect("alice id not found");

    let bob_id = app
        .find_user_id_by_username(&owner_token, "bob")
        .await
        .expect("find_user_id_by_username failed")
        .expect("bob id not found");

    // Alice uploads a private file (single chunk)
    let alice_filename = "alice_file.txt";
    let alice_file_id = {
        let upload_resp = app
            .upload_single_chunk_file(
                &alice_token,
                "file-alice-1",
                alice_filename,
                b"hello alice".to_vec(),
            )
            .await;
        assert!(
            upload_resp.status().is_success(),
            "alice upload failed: {}",
            upload_resp.status()
        );

        // Wait briefly to ensure file appears in listing (race safety)
        tokio::time::sleep(Duration::from_millis(100)).await;

        app.find_file_id_by_name(&alice_token, alice_filename)
            .await
            .expect("find_file_id_by_name err")
            .expect("alice file id not found")
    };

    // Owner uploads a file
    let owner_filename = "owner_file.txt";
    let owner_file_id = {
        let upload_resp = app
            .upload_single_chunk_file(
                &owner_token,
                "file-owner-1",
                owner_filename,
                b"owner secret".to_vec(),
            )
            .await;
        assert!(
            upload_resp.status().is_success(),
            "owner upload failed: {}",
            upload_resp.status()
        );

        tokio::time::sleep(Duration::from_millis(100)).await;

        app.find_file_id_by_name(&owner_token, owner_filename)
            .await
            .expect("find_file_id_by_name err")
            .expect("owner file id not found")
    };

    // Owner grants permissions:
    // alice => collaborator, bob => viewer
    let _ = app
        .grant_permission_and_get_row(&owner_token, owner_file_id, alice_id, "collaborator")
        .await
        .expect("grant collaborator to alice failed");

    let _ = app
        .grant_permission_and_get_row(&owner_token, owner_file_id, bob_id, "viewer")
        .await
        .expect("grant viewer to bob failed");

    // Small delay so DB changes are visible to subsequent requests
    tokio::time::sleep(Duration::from_millis(150)).await;

    // List accessible files for alice and bob
    let alice_files = app
        .list_accessible_files(&alice_token, alice_id)
        .await
        .expect("list_accessible_files alice failed");

    let bob_files = app
        .list_accessible_files(&bob_token, bob_id)
        .await
        .expect("list_accessible_files bob failed");

    // Assert alice sees her own file as owner
    let alice_owns = alice_files.iter().find(|f| f.id == alice_file_id);
    assert!(
        alice_owns.is_some(),
        "alice should see her own file in accessible list"
    );
    assert_eq!(
        alice_owns.unwrap().access_type,
        "owner",
        "alice's own file must have access_type == owner"
    );

    // Assert alice sees owner's file as collaborator
    let alice_owner_file = alice_files.iter().find(|f| f.id == owner_file_id);
    assert!(
        alice_owner_file.is_some(),
        "alice should see owner's file after being granted collaborator"
    );
    assert_eq!(
        alice_owner_file.unwrap().access_type,
        "collaborator",
        "alice should have collaborator access to owner's file"
    );

    // Assert bob sees owner's file as viewer, and does NOT see alice's private file
    let bob_owner_file = bob_files.iter().find(|f| f.id == owner_file_id);
    assert!(
        bob_owner_file.is_some(),
        "bob should see owner's file after being granted viewer"
    );
    assert_eq!(
        bob_owner_file.unwrap().access_type,
        "viewer",
        "bob should have viewer access to owner's file"
    );

    let bob_sees_alice = bob_files.iter().any(|f| f.id == alice_file_id);
    assert!(
        !bob_sees_alice,
        "bob must NOT see alice's private file (no permission)"
    );

    // cleanup
    app.cleanup();
}
