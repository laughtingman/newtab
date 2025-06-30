async function initOptions() {
	const popup = document.querySelector(".options");
	const properties = {
		show_folder_icons: {
			label: "Показывать иконки папок",
			type: "checkbox",
			value: "off",
		},
		show_favicons: {
			label: "Показывать иконки ссылок",
			type: "checkbox",
			value: "off",
		},
		dark_theme: {
			label: "Темная тема",
			type: "checkbox",
			value: "on",
		},
		background_image: {
			label: "Ссылка на фоновую картинку",
			type: "text",
			value: "",
		},
		background_position: {
			label: "Положение картинки",
			type: "select",
			value: "left",
			values: [
				{ value: "left", name: "Слева" },
				{ value: "right", name: "Справа" },
				{ value: "background", name: "На фоне" },
				{ value: "hidden", name: "Скрыта" },
			],
		},
		custom_css: {
			label: "Пользовательский CSS",
			type: "textarea",
			value: "",
		},
		local_folder: {
			label: "Папки-источник локальных закладок",
			type: "select",
			values: [
				{ value: "0", name: "Все" },
				{ value: "1", name: "Панель закладок" },
				{ value: "2", name: "Другие закладки" },
			],
			value: 1,
			enabledBy: "!use_raindrop",
		},
		use_raindrop: {
			label: "Использовать закладки из Raindrop вместо локальных",
			type: "checkbox",
			value: "off",
			trigger: true,
		},
		raindrop_api_key: {
			label: "Тестовый API ключ Raindrop",
			type: "password",
			value: "",
			enabledBy: "use_raindrop",
		},
		show_galleries: {
			label: "Показывать ссылки на галереи",
			type: "checkbox",
			value: "off",
			enabledBy: "use_raindrop",
		},
		censored_tags: {
			label: "Цензурить закладки с тегами",
			type: "text",
			value: "",
			enabledBy: "use_raindrop",
		},
		ignore_tags: {
			label: "Полностью скрывать закладки с тегами",
			type: "text",
			value: "",
			enabledBy: "use_raindrop",
		},
	};

	for (const [id, property] of Object.entries(properties)) {
		value = (await chrome.storage.sync.get([id]))[id] || property.value;

		let disabled = "";

		if (property.enabledBy != undefined) {
			if (property.enabledBy[0] != "!") {
				disabled = properties[property.enabledBy].value == "off" ? "disabled" : "";
			} else {
				disabled = properties[property.enabledBy.substring(1)].value == "on" ? "disabled" : "";
			}
		}

		let template = "<div class='propertyes'>";
		//let value = chrome.storage.sync.getItem(property || property.value;

		if (property.type == "text" || property.type == "password") {
			template += `<div class="property text">
				<label for='${id}'>${property.label}</label>
				<input id='${id}' name='${id}' type='${property.type}' value='${value}' ${disabled} class="filed">
			</div>
			`;
		}

		if (property.type == "checkbox") {
			let checked = value == "on" ? "checked" : "";
			template += `<div class="property checkbox">
				<input id='${id}' name='${id}' type='${property.type}' ${checked}  ${disabled}  class="filed">
				<label for='${id}'>${property.label}</label>
			</div>
			`;
		}

		if (property.type == "select") {
			template += `<div class="property select"><label for='${id}'>${property.label}</label><select id='${id}' name='${id}'  ${disabled}  class="filed">`;
			for (let option of property.values) {
				let selected = value == option.value ? "selected" : "";
				template += `<option value='${option.value}' ${selected}>${option.name}</option>`;
			}
			template += `</select></div>`;
		}

		if (property.type == "textarea") {
			template += `<div class="property text">
				<label for='${id}'>${property.label}</label>
				<textarea id='${id}' name='${id}' rows="5"  ${disabled} class="filed">${value}</textarea>
			</div>
			`;
		}

		template += "</div>";

		popup.innerHTML += template;
	}
	const saveBtn = document.querySelector(".save");
	saveBtn.addEventListener("click", async (event) => {
		for (const id of Object.keys(properties)) {
			let stored = {},
				value = "";
			let filed = document.querySelector("#" + id);
			if (filed.getAttribute("type") == "checkbox") {
				value = filed.checked ? "on" : "off";
			} else {
				value = filed.value;
			}
			stored[id] = value;
			await chrome.storage.sync.set(stored);
			window.close();
		}
	});

	const checkboxes = document.querySelectorAll("input[type=checkbox]");

	for (let checkbox of checkboxes) {
		toggleEnabledState(checkbox.id, checkbox.checked);
		checkbox.addEventListener("change", (event) => {
			toggleEnabledState(event.currentTarget.id, event.currentTarget.checked);
		});
	}

	function toggleEnabledState(enabledBy, checked) {
		for (const [id, property] of Object.entries(properties)) {
			if (property.enabledBy != undefined) {
				let filed = document.getElementById(id);
				if (property.enabledBy == enabledBy) {
					if (checked) {
						filed.removeAttribute("disabled");
					} else {
						filed.setAttribute("disabled", true);
					}
				}

				if (property.enabledBy == "!" + enabledBy) {
					if (!checked) {
						filed.removeAttribute("disabled");
					} else {
						filed.setAttribute("disabled", true);
					}
				}
			}
		}
	}
}

initOptions();
