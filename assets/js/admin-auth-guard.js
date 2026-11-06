const loginPath =
    document.body.dataset.adminLoginPath || "../login.html";

function redirectToAdminLogin() {

    const returnPath =
        window.location.pathname +
        window.location.search +
        window.location.hash;

    const loginUrl =
        new URL(loginPath, window.location.href);

    loginUrl.searchParams.set("return", returnPath);

    window.location.href = loginUrl.toString();
}

document.addEventListener("DOMContentLoaded", () => {

    firebase.auth().onAuthStateChanged(async (user) => {

        if (!user) {
            redirectToAdminLogin();
            return;
        }

        try {

            const idTokenResult =
                await user.getIdTokenResult(true);

            if (idTokenResult.claims.role !== "admin") {

                await firebase.auth().signOut();

                alert("You do not have administrator access.");

                redirectToAdminLogin();

                return;
            }

            document.body.style.visibility = "visible";

        } catch (error) {

            console.error(
                "Admin authentication check failed:",
                error
            );

            await firebase.auth().signOut();

            redirectToAdminLogin();
        }

    });

});

// Shared logout handler used by the Admin Portal landing page and accounting navigation.
window.adminSignOut = async function adminSignOut() {
    try {
        if (!window.firebase || !firebase.apps || !firebase.apps.length) {
            throw new Error("Firebase authentication is not initialised.");
        }

        await firebase.auth().signOut();

        const targetLoginPath =
            document.body.dataset.adminLoginPath || "../login.html";

        window.location.assign(
            new URL(targetLoginPath, window.location.href).toString()
        );
    } catch (error) {
        console.error("Admin sign-out failed:", error);
        window.alert("Unable to log out. Please try again.");
    }
};
