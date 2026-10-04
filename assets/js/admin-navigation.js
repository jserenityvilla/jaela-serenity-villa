(function () {
    "use strict";

    /*
     * Ja-Ela Serenity Villa - Admin Portal Navigation
     *
     * Shared navigation for all Admin Portal pages.
     * This file contains navigation only.
     * It does not replace Firebase authentication.
     */

    function getAdminRoot() {
        const path = window.location.pathname;
        const adminIndex = path.indexOf("/admin/");

        if (adminIndex === -1) {
            return "/admin/";
        }

        return path.substring(0, adminIndex) + "/admin/";
    }

    function getCurrentPage() {
        const path = window.location.pathname;

        if (
            path.endsWith("/admin/") ||
            path.endsWith("/admin/index.html")
        ) {
            return "dashboard";
        }

        if (path.includes("/accounts/bookings.html")) {
            return "bookings";
        }

        if (path.includes("/accounts/payments.html")) {
            return "payments";
        }

        if (path.includes("/accounts/expenses/")) {
            return "expenses";
        }

        if (path.includes("/accounts/categories.html")) {
            return "categories";
        }

        if (path.includes("/accounts/utilities/")) {
            return "utilities";
        }

        return "";
    }

    function createNavigation() {
        const existing = document.getElementById(
            "admin-portal-navigation"
        );

        if (existing) {
            return;
        }

        const adminRoot = getAdminRoot();
        const currentPage = getCurrentPage();

        const nav = document.createElement("nav");

        nav.id = "admin-portal-navigation";
        nav.className = "admin-portal-navigation";
        nav.setAttribute(
            "aria-label",
            "Admin Portal Navigation"
        );

        nav.innerHTML = `
            <div class="admin-portal-nav-inner">

                <div class="admin-portal-nav-header">

                    <div class="admin-portal-nav-brand">
                        <a
                            href="${adminRoot}"
                            class="admin-nav-link ${currentPage === "dashboard" ? "active" : ""}"
                            data-admin-page="dashboard"
                            aria-label="Admin Portal Dashboard">

                            <strong>
                                JA-ELA SERENITY VILLA
                            </strong>

                            <span>
                                ADMIN PORTAL
                            </span>

                        </a>
                    </div>

                </div>

                <div class="admin-portal-nav-main">

                    <div class="admin-portal-nav-row admin-nav-primary">

                        <a
                            href="${adminRoot}accounts/bookings.html"
                            class="admin-nav-link ${currentPage === "bookings" ? "active" : ""}"
                            data-admin-page="bookings">

                            <span class="admin-nav-icon">📅</span>
                            <span>Bookings</span>

                        </a>

                        <a
                            href="${adminRoot}accounts/payments.html"
                            class="admin-nav-link ${currentPage === "payments" ? "active" : ""}"
                            data-admin-page="payments">

                            <span class="admin-nav-icon">💳</span>
                            <span>Payments</span>

                        </a>

                        <a
                            href="${adminRoot}accounts/expenses/expenses.html"
                            class="admin-nav-link ${currentPage === "expenses" ? "active" : ""}"
                            data-admin-page="expenses">

                            <span class="admin-nav-icon">💰</span>
                            <span>Expenses</span>

                        </a>

                    </div>

                    <div class="admin-portal-nav-row admin-nav-secondary">

                        <a
                            href="${adminRoot}accounts/categories.html"
                            class="admin-nav-link ${currentPage === "categories" ? "active" : ""}"
                            data-admin-page="categories">

                            <span class="admin-nav-icon">📂</span>
                            <span>Categories</span>

                        </a>

                        <a
                            href="${adminRoot}accounts/utilities/utilities.html"
                            class="admin-nav-link ${currentPage === "utilities" ? "active" : ""}"
                            data-admin-page="utilities">

                            <span class="admin-nav-icon">💡</span>
                            <span>Utilities</span>

                        </a>

                    </div>

                </div>

                <div class="admin-portal-nav-actions">

                    <a
                        href="https://jaelaserenityvilla.com"
                        class="admin-nav-action admin-nav-website"
                        target="_blank"
                        rel="noopener noreferrer">

                        🌐 View Public Website

                    </a>

                    <button
                        type="button"
                        class="admin-nav-action admin-nav-logout"
                        id="adminPortalLogout">

                        🚪 Logout

                    </button>

                </div>

            </div>
        `;

        document.body.insertBefore(
            nav,
            document.body.firstChild
        );

        const logoutButton =
            document.getElementById(
                "adminPortalLogout"
            );

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                async function () {

                    if (
                        typeof adminSignOut === "function"
                    ) {
                        await adminSignOut();
                        return;
                    }

                    console.error(
                        "Admin logout function is not available."
                    );
                }
            );
        }
    }

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            createNavigation
        );

    } else {

        createNavigation();

    }

})();

