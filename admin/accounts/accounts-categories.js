document.addEventListener("DOMContentLoaded", async () => {

    const tableBody = document.getElementById("categoryTableBody");

    const categoryModal = document.getElementById("categoryModal");
    const closeCategoryModal = document.getElementById("closeCategoryModal");
    const cancelCategory = document.getElementById("cancelCategory");

    const categoryName = document.getElementById("categoryName");
    const categoryType = document.getElementById("categoryType");
    const categoryDescription = document.getElementById("categoryDescription");
    const categoryActive = document.getElementById("categoryActive");

    const categoryForm = document.getElementById("categoryForm");
    const addCategory = document.getElementById("addCategory");
    const categoryModalTitle = document.getElementById("categoryModalTitle");
    const categoryFilter = document.getElementById("categoryFilter");
    const categorySearch = document.getElementById("categorySearch");
    const categoryStatusFilter = document.getElementById("categoryStatusFilter");
    const categoryResultCount = document.getElementById("categoryResultCount");
    const categorySummary = document.getElementById("categorySummary");
    const clearCategoryFilters = document.getElementById("clearCategoryFilters");
    const categorySort = document.getElementById("categorySort");

    let categories = [];

    if (window.location.protocol === "file:") {

    }
    let editingCategoryId = null;

    function renderCategories() {

        const selectedType =
            categoryFilter.value;

        const selectedStatus =
            categoryStatusFilter.value;

        const searchTerm =
            categorySearch.value
                .toLowerCase()
                .trim();

        const filteredCategories =
            categories
                .filter(category => {

                const matchesType =
                    selectedType === "all" ||
                    category.categoryType === selectedType;

                const matchesStatus =
                    selectedStatus === "all" ||
                    String(category.active) === selectedStatus;

                const matchesSearch =
                    !searchTerm ||
                    String(category.name || "")
                        .toLowerCase()
                        .includes(searchTerm) ||
                    String(category.description || "")
                        .toLowerCase()
                        .includes(searchTerm);

                return (
                    matchesType &&
                    matchesStatus &&
                    matchesSearch
                );

            })
            .sort((a, b) => {

                switch (categorySort.value) {

                    case "nameAsc":
                        return a.name.localeCompare(
                            b.name,
                            undefined,
                            { sensitivity: "base" }
                        );

                    case "nameDesc":
                        return b.name.localeCompare(
                            a.name,
                            undefined,
                            { sensitivity: "base" }
                        );

                    case "sortOrder":
                    default:
                        return (
                            (Number(a.sortOrder) || 0) -
                            (Number(b.sortOrder) || 0)
                        );
                }

            });


        tableBody.innerHTML = "";

        categoryResultCount.textContent =
            `Showing ${filteredCategories.length} of ${categories.length} categories`;

        if (filteredCategories.length === 0) {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td colspan="4">
                    No financial categories have been configured yet.
                </td>
            `;

            tableBody.appendChild(row);

            return;
        }

        filteredCategories.forEach(category => {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${category.name}</td>

                <td>${category.categoryType}</td>

                <td>${category.description || "—"}</td>

                <td>
                    <span class="${category.active ? "status-active" : "status-inactive"}">
                        ${category.active ? "Active" : "Inactive"}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="category-button"
                        data-category-id="${category.id}">
                        Edit
                    </button>
                </td>
            `;

            tableBody.appendChild(row);
        });
    }

    async function loadCategories() {

        try {

            const collectionName =
                CONFIG.firestore.categoriesCollection;

            const snapshot =
                await db
                    .collection(collectionName)
                    .orderBy("sortOrder")
                    .get();

            categories = snapshot.docs.map(doc => {

                const data = doc.data();

                return {
                    id: doc.id,
                    name: data.name || "",
                    categoryType: data.categoryType || "",
                    parentCategoryId:
                        data.parentCategoryId || null,
                    description: data.description || "",
                    active: data.active !== false,
                    sortOrder: data.sortOrder || 0,
                    createdAt: data.createdAt || null,
                    updatedAt: data.updatedAt || null
                };

            });

            const incomeCount =
                categories.filter(
                    category => category.categoryType === "Income"
                ).length;

            const expenseCount =
                categories.filter(
                    category => category.categoryType === "Expense"
                ).length;

            const utilityCount =
                categories.filter(
                    category => category.categoryType === "Utility"
                ).length;

            categorySummary.textContent =
                `Income: ${incomeCount} | Expense: ${expenseCount} | Utility: ${utilityCount}`;

            renderCategories();

        } catch (error) {

            console.error(
                "Failed to load financial categories:",
                error
            );

            tableBody.innerHTML = `
                <tr>
                    <td colspan="4">
                        Unable to load financial categories.
                    </td>
                </tr>
            `;
        }
    }

    function openAddModal() {

        editingCategoryId = null;

        categoryName.value = "";
        categoryType.value = "Income";
        categoryActive.value = "true";

        categoryModalTitle.textContent = "Add Category";

        categoryModal.classList.add("show");
        categoryModal.setAttribute("aria-hidden", "false");

        categoryName.focus();
    }

    function openEditModal(category) {

        categoryModalTitle.textContent = "Edit Category";

        editingCategoryId = category.id;

        categoryName.value = category.name;
        categoryType.value = category.categoryType;
        categoryDescription.value = category.description || "";
        categoryActive.value = String(category.active);

        categoryModal.classList.add("show");
        categoryModal.setAttribute("aria-hidden", "false");

        categoryName.focus();
    }

    function closeModal() {

        categoryModalTitle.textContent = "Edit Category";

        categoryModal.classList.remove("show");
        categoryModal.setAttribute("aria-hidden", "true");

        editingCategoryId = null;
    }

    addCategory.addEventListener("click", openAddModal);

    categoryFilter.addEventListener("change", renderCategories);

    categorySearch.addEventListener("input", renderCategories);

    categoryStatusFilter.addEventListener("change", renderCategories);

    categorySort.addEventListener("change", renderCategories);

    clearCategoryFilters.addEventListener("click", () => {

        categorySearch.value = "";
        categoryFilter.value = "all";
        categoryStatusFilter.value = "all";

        renderCategories();

    });

    tableBody.addEventListener("click", event => {

        const button =
            event.target.closest("[data-category-id]");

        if (!button) {
            return;
        }

        const categoryId = button.dataset.categoryId;

        const category = categories.find(
            item => item.id === categoryId
        );

        if (category) {
            openEditModal(category);
        }

    });

    closeCategoryModal.addEventListener(
        "click",
        closeModal
    );

    cancelCategory.addEventListener(
        "click",
        closeModal
    );

    categoryModal.addEventListener("click", event => {

        if (event.target === categoryModal) {
            closeModal();
        }

    });

    categoryForm.addEventListener("submit", async event => {

        event.preventDefault();

        const name =
            categoryName.value
                .replace(/\s+/g, " ")
                .trim();

        const type = categoryType.value;

        const description =
            categoryDescription.value
                .replace(/\s+/g, " ")
                .trim();

        const status = categoryActive.value;

        const validTypes = [
            "Income",
            "Expense",
            "Utility"
        ];

        const validStatuses = [
            "true",
            "false"
        ];

        if (!name) {

            alert(
                "Category Name is required."
            );

            categoryName.focus();

            return;
        }

        if (name.length > 100) {

            alert(
                "Category Name cannot exceed 100 characters."
            );

            categoryName.focus();

            return;
        }

        if (!validTypes.includes(type)) {

            alert(
                "Invalid Category Type."
            );

            categoryType.focus();

            return;
        }

        if (!validStatuses.includes(status)) {

            alert(
                "Invalid Status."
            );

            categoryActive.focus();

            return;
        }

        const active = status === "true";

        const saveButton =
            categoryForm.querySelector(
                'button[type="submit"]'
            );

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {

            const collectionName =
                CONFIG.firestore.categoriesCollection;

            const normalizedName =
                name.toLowerCase().replace(/\s+/g, " ").trim();

            const duplicateCategory =
                categories.find(category => {

                    const existingName =
                        String(category.name || "")
                            .toLowerCase()
                            .replace(/\s+/g, " ")
                            .trim();

                    const sameType =
                        category.categoryType === type;

                    const differentRecord =
                        !editingCategoryId ||
                        category.id !== editingCategoryId;

                    return (
                        existingName === normalizedName &&
                        sameType &&
                        differentRecord
                    );

                });

            if (duplicateCategory) {

                alert(
                    "A category with this name and type already exists."
                );

                return;
            }

            if (editingCategoryId) {

                await db
                    .collection(collectionName)
                    .doc(editingCategoryId)
                    .update({
                        name: name,
                        categoryType: type,
                        active: active,
                        description: description,
                        updatedAt:
                            firebase.firestore.FieldValue.serverTimestamp()
                    });

            } else {

                const nextSortOrder =
                    categories.length > 0
                        ? Math.max(
                            ...categories.map(
                                item => Number(item.sortOrder) || 0
                            )
                        ) + 1
                        : 1;

                await db
                    .collection(collectionName)
                    .add({
                        name: name,
                        categoryType: type,
                        parentCategoryId: null,
                        description: description,
                        active: active,
                        sortOrder: nextSortOrder,
                        createdAt:
                            firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt:
                            firebase.firestore.FieldValue.serverTimestamp()
                    });

            }

            closeModal();

            await loadCategories();

        } catch (error) {

            console.error(
                "Failed to save financial category:",
                error
            );

            alert(
                "Unable to save the financial category. Please try again."
            );

        } finally {

            saveButton.disabled = false;
            saveButton.textContent = "Save Changes";

        }

    });

    await loadCategories();

});
