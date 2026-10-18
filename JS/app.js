"use strict";

/* CONFIGURACION GENERAL */

const STORAGE_KEY = "miGarage_v1";

const state = {
    vehicles: [],
    performances: [],
    records: [],
    photo: "",
    editingVehicleId: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const recordLabels = {
    mantenimiento: "Mantenimiento",
    reparacion: "Reparacion",
    inspeccion: "Inspeccion",
    modificacion: "Modificacion",
    reprogramacion: "Reprogramacion",
    nota: "Nota",
    otro: "Otro"
};

/* UTILIDADES */

function createId() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function getToday() {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;

    return new Date(date.getTime() - offset)
        .toISOString()
        .slice(0, 10);
}

function formatDate(value) {
    if (!value) return "Sin fecha";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return "Sin fecha";

    return date.toLocaleDateString("es-SV", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("es-SV");
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-US", {
        style: "currency",
        currency: "USD"
    });
}

function getVehicleName(vehicle) {
    if (!vehicle) return "Vehiculo desconocido";

    return [vehicle.marca, vehicle.modelo]
        .filter(Boolean)
        .join(" ") || "Vehiculo sin nombre";
}

function getVehicle(vehicleId) {
    return state.vehicles.find(vehicle => vehicle.id === vehicleId);
}

function getFormData(form) {
    return new FormData(form);
}

/* NOTIFICACIONES */

function notify(message, isError = false) {
    let notification = $("#garage-notification");

    if (!notification) {
        notification = document.createElement("div");
        notification.id = "garage-notification";
        notification.className = "garage-notification";
        notification.setAttribute("role", "status");

        Object.assign(notification.style, {
            position: "fixed",
            right: "20px",
            bottom: "20px",
            zIndex: "99999",
            padding: "14px 18px",
            borderRadius: "10px",
            color: "#ffffff",
            background: "#20275c",
            boxShadow: "0 6px 20px rgba(0,0,0,.2)",
            maxWidth: "calc(100% - 40px)"
        });

        document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.style.background = isError ? "#b42318" : "#20275c";
    notification.style.display = "block";

    clearTimeout(notification._timeout);

    notification._timeout = setTimeout(() => {
        notification.style.display = "none";
    }, 3500);
}

/* ALMACENAMIENTO */

function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) return;

        const parsed = JSON.parse(stored);

        state.vehicles = Array.isArray(parsed.vehicles)
            ? parsed.vehicles
            : [];

        state.performances = Array.isArray(parsed.performances)
            ? parsed.performances
            : [];

        state.records = Array.isArray(parsed.records)
            ? parsed.records
            : [];

    } catch (error) {
        console.error("Error al cargar Mi Garage:", error);
        notify("No se pudieron cargar los datos guardados.", true);
    }
}

function snapshotState() {
    return JSON.stringify({
        vehicles: state.vehicles,
        performances: state.performances,
        records: state.records
    });
}

function commitChanges(previousState, successMessage) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            vehicles: state.vehicles,
            performances: state.performances,
            records: state.records
        }));

        renderAll();
        notify(successMessage);

        return true;

    } catch (error) {
        console.error("Error al guardar Mi Garage:", error);

        try {
            const previous = JSON.parse(previousState);

            state.vehicles = previous.vehicles;
            state.performances = previous.performances;
            state.records = previous.records;

            renderAll();

        } catch (restoreError) {
            console.error("Error al restaurar los datos:", restoreError);
        }

        notify(
            "No se pudieron guardar los cambios. Revisa el almacenamiento del navegador.",
            true
        );

        return false;
    }
}

/* NAVEGACION */

function showView(viewName) {
    $$(".view").forEach(view => {
        view.classList.toggle(
            "active",
            view.id === `view-${viewName}`
        );
    });

    $$(".nav-link").forEach(link => {
        link.classList.toggle(
            "active",
            link.dataset.view === viewName
        );
    });

    const names = {
        inicio: "Panel principal",
        vehiculos: "Mis vehiculos",
        rendimiento: "Rendimiento",
        bitacora: "Bitacora"
    };

    const breadcrumb = $("#breadcrumb-current");

    if (breadcrumb) {
        breadcrumb.textContent = names[viewName] || viewName;
    }

    const sidebar = $("#sidebar");

    if (sidebar) sidebar.classList.remove("open");

    const mobileMenu = $("#mobile-menu");

    if (mobileMenu) {
        mobileMenu.setAttribute("aria-expanded", "false");
    }
}

/* TARJETAS DE VEHICULOS */

function createVehicleCard(vehicle) {
    const photo = vehicle.photo
        ? `<img src="${escapeHTML(vehicle.photo)}"
                alt="${escapeHTML(getVehicleName(vehicle))}"
                class="vehicle-photo">`
        : `<div class="vehicle-photo-placeholder">
                <span>🚘</span>
                <small>Sin fotografia</small>
           </div>`;

    return `
        <article class="vehicle-card">
            <div class="vehicle-card-image">
                ${photo}
            </div>

            <div class="vehicle-card-body">
                <h3>${escapeHTML(getVehicleName(vehicle))}</h3>

                <p>Año:
                    <strong>${escapeHTML(vehicle.anio || "No indicado")}</strong>
                </p>

                <p>Placa:
                    <strong>${escapeHTML(vehicle.placa || "No indicada")}</strong>
                </p>

                <p>Kilometraje:
                    <strong>${formatNumber(vehicle.kilometraje)} km</strong>
                </p>

                <div class="vehicle-card-actions">
                    <button type="button"
                        data-action="view-vehicle"
                        data-id="${escapeHTML(vehicle.id)}">
                        Ver ficha
                    </button>

                    <button type="button"
                        data-action="edit-vehicle"
                        data-id="${escapeHTML(vehicle.id)}">
                        Editar
                    </button>

                    <button type="button"
                        class="danger"
                        data-action="delete-vehicle"
                        data-id="${escapeHTML(vehicle.id)}">
                        Eliminar
                    </button>
                </div>
            </div>
        </article>
    `;
}

/* VISTA DE VEHICULOS */

function renderVehicles() {
    const dashboard = $("#dashboard-vehicles");
    const container = $("#all-vehicles");
    const searchInput = $("#vehicle-search");

    const search = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const filtered = state.vehicles.filter(vehicle => {
        const searchable = [
            vehicle.marca,
            vehicle.modelo,
            vehicle.anio,
            vehicle.placa,
            vehicle.motor
        ].join(" ").toLowerCase();

        return searchable.includes(search);
    });

    if (dashboard) {
        dashboard.innerHTML = [...state.vehicles]
            .slice(0, 3)
            .map(createVehicleCard)
            .join("");
    }

    if (container) {
        container.innerHTML = filtered
            .map(createVehicleCard)
            .join("");
    }

    const dashboardEmpty = $("#dashboard-empty");

    if (dashboardEmpty) {
        dashboardEmpty.classList.toggle(
            "hidden",
            state.vehicles.length > 0
        );
    }

    const vehiclesEmpty = $("#vehicles-empty");

    if (vehiclesEmpty) {
        vehiclesEmpty.classList.toggle(
            "hidden",
            filtered.length > 0
        );
    }

    const count = $("#stat-vehicles");

    if (count) {
        count.textContent = String(state.vehicles.length);
    }
}

/* VISTA DE BITACORA */

function renderRecords() {
    const container = $("#records-table");
    const searchInput = $("#record-search");

    if (!container) return;

    const search = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const filtered = [...state.records]
        .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
        .filter(record => {
            const vehicle = getVehicle(record.vehiculoId);

            const searchable = [
                record.titulo,
                record.tipo,
                record.descripcion,
                vehicle ? getVehicleName(vehicle) : ""
            ].join(" ").toLowerCase();

            return searchable.includes(search);
        });

    container.innerHTML = filtered.map(record => {
        const vehicle = getVehicle(record.vehiculoId);

        return `
            <tr>
                <td>
                    <strong>${escapeHTML(record.titulo || "Registro sin titulo")}</strong>
                    <small>${escapeHTML(
                        recordLabels[record.tipo] || record.tipo || "Otro"
                    )}</small>
                </td>

                <td>${escapeHTML(getVehicleName(vehicle))}</td>

                <td>${formatDate(record.fecha)}</td>

                <td>${record.kilometraje
                    ? escapeHTML(record.kilometraje) + " km"
                    : "No indicado"}</td>

                <td>${formatMoney(record.costo)}</td>

                <td>
                    <button type="button"
                        class="mini-button danger"
                        data-action="delete-record"
                        data-id="${escapeHTML(record.id)}">
                        Eliminar
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    const empty = $("#records-empty");

    if (empty) {
        empty.classList.toggle("hidden", filtered.length > 0);
    }

    const count = $("#stat-records");

    if (count) {
        count.textContent = String(state.records.length);
    }

    const mods = $("#stat-mods");

    if (mods) {
        mods.textContent = String(
            state.records.filter(record =>
                ["modificacion", "reprogramacion"].includes(record.tipo)
            ).length
        );
    }

    const costs = $("#stat-cost");

    if (costs) {
        costs.textContent = formatMoney(
            state.records.reduce(
                (total, record) => total + Number(record.costo || 0),
                0
            )
        );
    }
}

/* ACTIVIDAD RECIENTE */

function renderRecentActivity() {
    const container = $("#recent-activity");

    if (!container) return;

    const recent = [...state.records]
        .sort((a, b) =>
            (b.creado || b.fecha || "")
                .localeCompare(a.creado || a.fecha || "")
        )
        .slice(0, 5);

    container.innerHTML = recent.map(record => {
        const vehicle = getVehicle(record.vehiculoId);

        return `
            <article class="activity-item">
                <div>
                    <strong>${escapeHTML(record.titulo || "Registro sin titulo")}</strong>
                    <p>${escapeHTML(getVehicleName(vehicle))}</p>
                </div>

                <small>${formatDate(record.fecha)}</small>
            </article>
        `;
    }).join("");

    const empty = $("#activity-empty");

    if (empty) {
        empty.classList.toggle("hidden", recent.length > 0);
    }
}

/* FIN DE LA PARTE 1 */

/* RENDIMIENTO */

function renderPerformance() {
    const container = $("#performance-content");

    if (!container) return;

    container.innerHTML = state.performances.map(item => {
        const vehicle = getVehicle(item.vehiculoId);

        return `
            <article class="performance-card">
                <div class="performance-card-header">
                    <div>
                        <h3>${escapeHTML(
                            item.titulo ||
                            (item.tipo === "modificado"
                                ? "Rendimiento modificado"
                                : "Rendimiento de fabrica")
                        )}</h3>

                        <p>${escapeHTML(getVehicleName(vehicle))}</p>
                    </div>

                    <button type="button"
                        class="mini-button danger"
                        data-action="delete-performance"
                        data-id="${escapeHTML(item.id)}">
                        Eliminar
                    </button>
                </div>

                <div class="performance-values">
                    <div>
                        <small>Potencia</small>
                        <strong>${item.potencia
                            ? escapeHTML(item.potencia) + " HP"
                            : "No indicada"}</strong>
                    </div>

                    <div>
                        <small>RPM de potencia</small>
                        <strong>${item.potenciaRpmMax
                            ? escapeHTML(item.potenciaRpmMax) + " RPM"
                            : "No indicadas"}</strong>
                    </div>

                    <div>
                        <small>Torque</small>
                        <strong>${item.torque
                            ? escapeHTML(item.torque) + " Nm"
                            : "No indicado"}</strong>
                    </div>

                    <div>
                        <small>RPM de torque</small>
                        <strong>${item.torqueRpmMax
                            ? escapeHTML(item.torqueRpmMax) + " RPM"
                            : "No indicadas"}</strong>
                    </div>
                </div>

                ${item.notas
                    ? `<p>${escapeHTML(item.notas)}</p>`
                    : ""}
            </article>
        `;
    }).join("");

    const empty = $("#performance-empty");

    if (empty) {
        empty.classList.toggle(
            "hidden",
            state.performances.length > 0
        );
    }
}

/* FOTOGRAFIAS */

function showPhotoPreview(photo) {
    const preview = $("#photo-preview");

    if (!preview) return;

    if (!photo) {
        resetPhotoPreview();
        return;
    }

    if (preview.tagName === "IMG") {
        preview.src = photo;
        preview.alt = "Fotografia del vehiculo";
        preview.classList.remove("hidden");
        return;
    }

    preview.innerHTML = `
        <img src="${escapeHTML(photo)}"
             alt="Fotografia del vehiculo"
             class="photo-preview-image">
    `;

    preview.classList.remove("hidden");
}

function resetPhotoPreview() {
    const preview = $("#photo-preview");

    if (!preview) return;

    if (preview.tagName === "IMG") {
        preview.removeAttribute("src");
        preview.classList.add("hidden");
        return;
    }

    preview.innerHTML = "Vista previa de la foto";
}

function handlePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        notify("Selecciona una imagen JPG, PNG o WEBP.", true);
        event.target.value = "";
        return;
    }

    if (file.size > 3 * 1024 * 1024) {
        notify("La fotografia debe pesar menos de 3 MB.", true);
        event.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        state.photo = String(reader.result || "");
        showPhotoPreview(state.photo);
    };

    reader.onerror = () => {
        notify("No se pudo leer la fotografia.", true);
    };

    reader.readAsDataURL(file);
}

/* MODAL */

function openModal(formId, title, submitLabel) {
    const backdrop = $("#modal-backdrop");
    const form = $(`#${formId}`);

    if (!backdrop || !form) {
        notify("No se encontro el formulario solicitado.", true);
        return;
    }

    $$(".modal-form").forEach(item => {
        item.classList.add("hidden");
    });

    form.classList.remove("hidden");

    const titleElement = $("#modal-title");

    if (titleElement) {
        titleElement.textContent = title;
    }

    const submitButton = form.querySelector('[type="submit"]');

    if (submitButton) {
        submitButton.textContent = submitLabel;
    }

    backdrop.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
    backdrop.style.display = "flex";

    document.body.classList.add("modal-open");

    const firstInput = form.querySelector(
        'input:not([type="hidden"]):not([type="file"]), select, textarea'
    );

    if (firstInput) {
        setTimeout(() => firstInput.focus(), 50);
    }
}

function closeModal() {
    const backdrop = $("#modal-backdrop");

    if (!backdrop) return;

    backdrop.classList.add("hidden");
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.style.display = "none";

    document.body.classList.remove("modal-open");

    state.editingVehicleId = null;
    state.photo = "";

    $$(".modal-form").forEach(form => {
        form.reset();
        form.classList.add("hidden");
    });

    resetPhotoPreview();
}

/* FORMULARIO DE VEHICULOS */

function openVehicleForm(vehicle = null) {
    const form = $("#vehicle-form");

    if (!form) {
        notify("No se encontro el formulario de vehiculos.", true);
        return;
    }

    form.reset();

    state.editingVehicleId = vehicle ? vehicle.id : null;
    state.photo = vehicle ? vehicle.photo || "" : "";

    if (vehicle) {
        [
            "marca", "modelo", "anio", "placa",
            "motor", "transmision", "kilometraje"
        ].forEach(name => {
            const input = form.elements.namedItem(name);

            if (input) input.value = vehicle[name] ?? "";
        });

        showPhotoPreview(state.photo);
    } else {
        resetPhotoPreview();
    }

    openModal(
        "vehicle-form",
        vehicle ? "Editar vehiculo" : "Agregar vehiculo",
        vehicle ? "Guardar cambios" : "Guardar vehiculo"
    );
}

/* SELECTORES DE VEHICULOS */

function populateVehicleSelects() {
    const selects = $$(
        '#performance-form select[name="vehiculoId"], ' +
        '#record-form select[name="vehiculoId"], ' +
        '#performance-vehicle'
    );

    selects.forEach(select => {
        const previousValue = select.value;

        select.innerHTML = `
            <option value="">Selecciona un vehiculo</option>
            ${state.vehicles.map(vehicle => `
                <option value="${escapeHTML(vehicle.id)}">
                    ${escapeHTML(getVehicleName(vehicle))}
                </option>
            `).join("")}
        `;

        if (state.vehicles.some(vehicle => vehicle.id === previousValue)) {
            select.value = previousValue;
        }
    });
}

/* ABRIR FORMULARIOS */

function openPerformanceForm() {
    if (!state.vehicles.length) {
        notify("Primero agrega un vehiculo.", true);
        openVehicleForm();
        return;
    }

    const form = $("#performance-form");

    if (!form) return;

    form.reset();
    populateVehicleSelects();

    openModal(
        "performance-form",
        "Registrar rendimiento",
        "Guardar rendimiento"
    );
}

function openRecordForm() {
    if (!state.vehicles.length) {
        notify("Primero agrega un vehiculo.", true);
        openVehicleForm();
        return;
    }

    const form = $("#record-form");

    if (!form) return;

    form.reset();

    const dateInput = form.elements.namedItem("fecha");

    if (dateInput) dateInput.value = getToday();

    populateVehicleSelects();

    openModal("record-form", "Nuevo registro", "Guardar registro");
}

/* GUARDAR VEHICULOS */

function handleVehicleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.reportValidity()) return;

    const data = getFormData(form);
    const marca = String(data.get("marca") || "").trim();
    const modelo = String(data.get("modelo") || "").trim();

    if (!marca || !modelo) {
        notify("Completa la marca y el modelo.", true);
        return;
    }

    const old = state.editingVehicleId
        ? getVehicle(state.editingVehicleId)
        : null;

    const vehicle = {
        id: old?.id || createId(),
        marca,
        modelo,
        anio: String(data.get("anio") || "").trim(),
        placa: String(data.get("placa") || "").trim(),
        motor: String(data.get("motor") || "").trim(),
        transmision: String(data.get("transmision") || "").trim(),
        kilometraje: Number(data.get("kilometraje")) || 0,
        photo: state.photo || old?.photo || "",
        creado: old?.creado || new Date().toISOString()
    };

    const previous = snapshotState();

    if (old) {
        state.vehicles = state.vehicles.map(item =>
            item.id === old.id ? vehicle : item
        );
    } else {
        state.vehicles.unshift(vehicle);
    }

    const saved = commitChanges(
        previous,
        old
            ? "Vehiculo actualizado correctamente."
            : "Vehiculo agregado correctamente."
    );

    if (saved) {
        populateVehicleSelects();
        closeModal();
    }
}

/* GUARDAR RENDIMIENTO */

function handlePerformanceSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.reportValidity()) return;

    const data = getFormData(form);
    const vehiculoId = String(data.get("vehiculoId") || "");

    if (!getVehicle(vehiculoId)) {
        notify("Selecciona un vehiculo valido.", true);
        return;
    }

    const previous = snapshotState();

    state.performances.unshift({
        id: createId(),
        vehiculoId,
        tipo: String(data.get("tipo") || "fabrica"),
        potencia: String(data.get("potencia") || ""),
        potenciaRpmMin: String(data.get("potenciaRpmMin") || ""),
        potenciaRpmMax: String(data.get("potenciaRpmMax") || ""),
        torque: String(data.get("torque") || ""),
        torqueRpmMin: String(data.get("torqueRpmMin") || ""),
        torqueRpmMax: String(data.get("torqueRpmMax") || ""),
        fuente: String(data.get("fuente") || ""),
        notas: String(data.get("notas") || ""),
        fecha: getToday(),
        creado: new Date().toISOString()
    });

    if (commitChanges(previous, "Rendimiento registrado correctamente.")) {
        closeModal();
    }
}

/* GUARDAR BITACORA */

function handleRecordSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (!form.reportValidity()) return;

    const data = getFormData(form);
    const vehiculoId = String(data.get("vehiculoId") || "");

    if (!getVehicle(vehiculoId)) {
        notify("Selecciona un vehiculo valido.", true);
        return;
    }

    const previous = snapshotState();

    state.records.unshift({
        id: createId(),
        vehiculoId,
        titulo: String(data.get("titulo") || "").trim(),
        tipo: String(data.get("tipo") || "mantenimiento"),
        fecha: String(data.get("fecha") || getToday()),
        kilometraje: String(data.get("kilometraje") || ""),
        costo: String(data.get("costo") || ""),
        descripcion: String(data.get("descripcion") || "").trim(),
        creado: new Date().toISOString()
    });

    if (commitChanges(previous, "Registro guardado correctamente.")) {
        closeModal();
    }
}

/* FICHA DEL VEHICULO */

function viewVehicle(vehicleId) {
    const vehicle = getVehicle(vehicleId);

    if (!vehicle) return;

    const records = state.records.filter(
        item => item.vehiculoId === vehicleId
    );

    const performances = state.performances.filter(
        item => item.vehiculoId === vehicleId
    );

    alert([
        `Vehiculo: ${getVehicleName(vehicle)}`,
        `Año: ${vehicle.anio || "No indicado"}`,
        `Placa: ${vehicle.placa || "No indicada"}`,
        `Motor: ${vehicle.motor || "No indicado"}`,
        `Transmision: ${vehicle.transmision || "No indicada"}`,
        `Kilometraje: ${formatNumber(vehicle.kilometraje)} km`,
        `Registros: ${records.length}`,
        `Datos de rendimiento: ${performances.length}`
    ].join("\n"));
}

/* ELIMINAR ELEMENTOS */

function deleteVehicle(vehicleId) {
    const vehicle = getVehicle(vehicleId);

    if (!vehicle) return;

    if (!confirm(
        `¿Quieres eliminar ${getVehicleName(vehicle)}? Tambien se eliminaran sus registros asociados.`
    )) return;

    const previous = snapshotState();

    state.vehicles = state.vehicles.filter(item => item.id !== vehicleId);
    state.performances = state.performances.filter(
        item => item.vehiculoId !== vehicleId
    );
    state.records = state.records.filter(
        item => item.vehiculoId !== vehicleId
    );

    if (commitChanges(previous, "Vehiculo eliminado correctamente.")) {
        populateVehicleSelects();
    }
}

function deletePerformance(id) {
    if (!confirm("¿Quieres eliminar este registro de rendimiento?")) return;

    const previous = snapshotState();

    state.performances = state.performances.filter(item => item.id !== id);

    commitChanges(previous, "Rendimiento eliminado.");
}

function deleteRecord(id) {
    if (!confirm("¿Quieres eliminar este registro de bitacora?")) return;

    const previous = snapshotState();

    state.records = state.records.filter(item => item.id !== id);

    commitChanges(previous, "Registro eliminado correctamente.");
}

/* ACCIONES DE LOS BOTONES */

function handleAction(action, id) {
    switch (action) {
        case "new-vehicle":
            openVehicleForm();
            break;

        case "new-performance":
            openPerformanceForm();
            break;

        case "new-record":
            openRecordForm();
            break;

        case "view-vehicle":
            viewVehicle(id);
            break;

        case "edit-vehicle":
            openVehicleForm(getVehicle(id));
            break;

        case "delete-vehicle":
            deleteVehicle(id);
            break;

        case "delete-performance":
            deletePerformance(id);
            break;

        case "delete-record":
            deleteRecord(id);
            break;

        default:
            console.warn("Accion desconocida:", action);
    }
}

/* ACTUALIZAR LA APLICACION */

function renderAll() {
    renderVehicles();
    renderRecords();
    renderPerformance();
    renderRecentActivity();
}

/* INICIALIZACION */

function initApp() {
    loadState();

    const vehicleForm = $("#vehicle-form");
    const performanceForm = $("#performance-form");
    const recordForm = $("#record-form");

    if (vehicleForm) {
        vehicleForm.addEventListener("submit", handleVehicleSubmit);
    }

    if (performanceForm) {
        performanceForm.addEventListener("submit", handlePerformanceSubmit);
    }

    if (recordForm) {
        recordForm.addEventListener("submit", handleRecordSubmit);
    }

    const photoInput = $("#vehicle-photo");

    if (photoInput) {
        photoInput.addEventListener("change", handlePhotoChange);
    }

    $$(".nav-link").forEach(button => {
        button.addEventListener("click", () => {
            showView(button.dataset.view);
        });
    });

    document.addEventListener("click", event => {
        if (!(event.target instanceof Element)) return;

        const button = event.target.closest("[data-action]");

        if (!button) return;

        handleAction(
            button.dataset.action,
            button.dataset.id
        );
    });

    const vehicleSearch = $("#vehicle-search");

    if (vehicleSearch) {
        vehicleSearch.addEventListener("input", renderVehicles);
    }

    const recordSearch = $("#record-search");

    if (recordSearch) {
        recordSearch.addEventListener("input", renderRecords);
    }

    const closeButton = $("#modal-close");

    if (closeButton) {
        closeButton.addEventListener("click", closeModal);
    }

    $$("[data-close]").forEach(button => {
        button.addEventListener("click", closeModal);
    });

    const backdrop = $("#modal-backdrop");

    if (backdrop) {
        backdrop.addEventListener("click", event => {
            if (event.target === backdrop) closeModal();
        });

        backdrop.style.display = "none";
        backdrop.setAttribute("aria-hidden", "true");
    }

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeModal();
    });

    const menuButton = $("#mobile-menu");
    const sidebar = $("#sidebar");

    if (menuButton && sidebar) {
        menuButton.addEventListener("click", () => {
            const isOpen = sidebar.classList.toggle("open");

            menuButton.setAttribute("aria-expanded", String(isOpen));
        });
    }

    const todayDate = $("#today-date");

    if (todayDate) {
        todayDate.textContent = new Date().toLocaleDateString("es-SV", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    populateVehicleSelects();
    renderAll();

    console.log("Mi Garage esta listo.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}