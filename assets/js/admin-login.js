document.addEventListener("DOMContentLoaded", () => {

    const loginForm =
        document.getElementById("adminLoginForm");

    const emailInput =
        document.getElementById("adminEmail");

    const passwordInput =
        document.getElementById("adminPassword");

    const loginButton =
        document.getElementById("adminLoginButton");

    const message =
        document.getElementById("adminLoginMessage");

    function showMessage(text, type) {

        message.textContent = text;

        message.className =
            "admin-login-message " + type;

    }

    function getReturnTarget() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const returnTarget =
            params.get("return");

        if (
            returnTarget &&
            returnTarget.startsWith("/")
        ) {
            return returnTarget;
        }

        return "accounts/categories.html";
    }

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;

        if (!email || !password) {

            showMessage(
                "Please enter your email address and password.",
                "error"
            );

            return;
        }

        loginButton.disabled = true;

        loginButton.textContent =
            "Signing In...";

        try {

            const userCredential =
                await firebase
                    .auth()
                    .signInWithEmailAndPassword(
                        email,
                        password
                    );

            const user =
                userCredential.user;

            const idTokenResult =
                await user.getIdTokenResult(true);

            if (
                idTokenResult.claims.role !==
                "admin"
            ) {

                await firebase
                    .auth()
                    .signOut();

                showMessage(
                    "Your account does not have administrator access.",
                    "error"
                );

                return;
            }

            showMessage(
                "Login successful. Redirecting...",
                "success"
            );

            const returnTarget =
                getReturnTarget();

            setTimeout(() => {

                window.location.href =
                    returnTarget;

            }, 800);

        } catch (error) {

            console.error(
                "Admin login failed:",
                error
            );

            showMessage(
                "Unable to sign in. Please check your email and password.",
                "error"
            );

        } finally {

            loginButton.disabled = false;

            loginButton.textContent =
                "Sign In";

        }

    });

});
