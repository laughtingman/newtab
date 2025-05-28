async function initOptions() {
	const popup = document.querySelector(".options");
	const properties = {
		raindrop_api_key: {
			label: "Тестовый API ключ Raindrop",
			type: "password",
			value: "",
		},
		dark_theme: {
			label: "Темная тема",
			type: "checkbox",
			value: "on",
		},
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
		show_galleries: {
			label: "Показывать ссылки на галереи",
			type: "checkbox",
			value: "off",
		},
		censored_tags: {
			label: "Цензурить закладки с тегами",
			type: "text",
			value: "",
		},
		ignore_tags: {
			label: "Полностью скрывать закладки с тегами",
			type: "text",
			value: "",
		},
	};

	for (const [id, property] of Object.entries(properties)) {
		value = (await chrome.storage.sync.get([id]))[id] || property.value;

		let template = "<div class='property'>";
		//let value = chrome.storage.sync.getItem(property || property.value;

		if (property.type == "text" || property.type == "password") {
			template += `<div class="property text">
				<label for='${id}'>${property.label}</label>
				<input id='${id}' name='${id}' type='${property.type}' value='${value}'>
			</div>
			`;
		}

		if (property.type == "checkbox") {
			let checked = value == "on" ? "checked" : "";
			template += `<div class="property checkbox">
				<input id='${id}' name='${id}' type='${property.type}' ${checked}>
				<label for='${id}'>${property.label}</label>
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
}

initOptions();
