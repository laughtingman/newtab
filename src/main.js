async function init() {
	const app = document.querySelector("#app");
	const searchFiled = app.querySelector(".searchFiled");

	//Получаем настройки расширения
	let properties = {};
	const propertyKeys = ["use_raindrop", "dark_theme", "raindrop_api_key", "show_folder_icons", "show_favicons", "show_galleries", "censored_tags", "ignore_tags", "background_image", "background_position", "custom_css"];

	for (let key of propertyKeys) {
		properties[key] = (await chrome.storage.sync.get(key))[key] || null;
	}

	//Превращаем некоторые настройки в сеты для удобства
	properties["censored_tags"] = properties["censored_tags"] ? new Set(properties["censored_tags"].split(",")) : new Set();
	properties["ignore_tags"] = properties["ignore_tags"] ? new Set(properties["ignore_tags"].split(",")) : new Set();

	//Применяем стили и фоновую картинку
	function initStyle() {
		if (properties.dark_theme === "on") document.body.classList.add("dark");

		if (properties["background_image"] != null) {
			let oldCover = document.querySelector(".cover");
			if (oldCover) oldCover.remove();

			let cover = document.createElement("div");
			cover.classList.add("cover");

			if (properties["background_position"] != null) {
				cover.classList.add(properties["background_position"]);
			}

			let img = document.createElement("img");
			img.src = properties["background_image"];
			img.onload = () => {
				cover.appendChild(img);
				document.querySelector("#app").appendChild(cover);
			};
			img.onerror = () => {
				cover.remove();
			};
		}

		if (properties["custom_css"] != null) {
			let userStyle = document.querySelector("style#userStyle");
			if (!userStyle) {
				userStyle = document.createElement("style");
				userStyle.setAttribute("type", "text/css");
				userStyle.setAttribute("id", "userStyle");
				document.body.appendChild(userStyle);
			}
			userStyle.innerText = properties["custom_css"];
		}
	}

	const token = properties["raindrop_api_key"];

	//const faviconProvider = "https://www.google.com/s2/favicons?&sz=24&domain=https://";
	const faviconProvider = "http://favicon.yandex.net/favicon/";

	//Поиск через поисковые системы
	const internetSearch = (url) => {
		const query = searchFiled.value;
		if (query === "") {
			return;
		}
		document.location.href = url + query;
	};

	//Обработчик клика по кнопкам поисковых систем
	const searchButtons = app.querySelectorAll(".searchForm .btn");
	for (let btn of searchButtons) {
		btn.addEventListener("click", (event) => {
			internetSearch(btn.dataset.url);
		});
	}

	//Обрапотчик нажатия Enter в поисковой строке
	searchFiled.addEventListener("keydown", (event) => {
		if (event.key == "Enter") {
			let btn = app.querySelector(".searchForm .btn");
			internetSearch(btn.dataset.url);
		}
	});

	async function initLocalBookmarks() {
		let tree = app.querySelector(".tree");
		tree.innerHTML = "";
		let subfolders = document.createElement("ul");
		subfolders.classList.add("folder");
		tree.appendChild(subfolders);

		let items = [];

		await chrome.bookmarks.getSubTree("2", (itemTree) => {
			itemTree[0].children.forEach((item) => {
				let output = drawItem(item);
				subfolders.innerHTML += output.html;
				items.push(...output.items);
			});

			initFuseSearch(items);
		});

		function drawItem(item) {
			//console.log(item);
			let output = "";
			let items = [];
			if (item.url) {
				item.link = item.url;
				item.abbr = getAbbr(item.title);
				item.translate = keyboardTranslate(item.title);
				item["_id"] = item.id;

				items.push(item);
				output = `<li class='item' id='item_${item.id}'>`;

				let host = item.url.split("/")[2];
				let icon = `<img src='${faviconProvider}${host}' data-host="${item.link}" class="icon">`;
				if (properties.show_favicons !== "on") {
					icon = "";
				}
				output += `<a href='${item.url}'>${icon}<span class='title'>${item.title}</span></a>`;
				output += `</li>`;
			} else {
				if (item.children.length == 0) {
					return "";
				}
				output = `<li class='folder'>`;
				let icon = `<svg class='icon'><use xlink:href="#default_collection"></use></svg>`;

				if (properties.show_folder_icons !== "on") {
					icon = "";
				}

				output += `<div><span>${icon}<span class='title'>${item.title}</span></span></div>`;
				output += `<ul class='subitems'>`;

				for (let child of item.children) {
					let process = drawItem(child);
					output += process.html;
					items.push(...process.items);
				}

				output += "</ul>";
				output += `</li>`;
			}
			return { html: output, items: items };
		}

		updateLocalEvents(true);
	}

	function updateLocalEvents(enable) {
		if (enable) {
			chrome.bookmarks.onChanged.addListener(initLocalBookmarks);
			chrome.bookmarks.onMoved.addListener(initLocalBookmarks);
			chrome.bookmarks.onRemoved.addListener(initLocalBookmarks);
			chrome.bookmarks.onCreated.addListener(initLocalBookmarks);
		} else {
			chrome.bookmarks.onChanged.removeListener(initLocalBookmarks);
			chrome.bookmarks.onMoved.removeListener(initLocalBookmarks);
			chrome.bookmarks.onRemoved.removeListener(initLocalBookmarks);
			chrome.bookmarks.onCreated.removeListener(initLocalBookmarks);
		}
	}

	//Подключаемся к Raindrop и берем оттуда дерево закладок
	async function initRaindrop() {
		updateLocalEvents(false);
		async function getItems(token, page = 0) {
			const response = await fetch(`https://api.raindrop.io/rest/v1/raindrops/0?page=${page}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const json = await response.json();
			let items = json.items;

			items.map((item) => {
				item.translate = keyboardTranslate(item.title);
				item.abbr = getAbbr(item.title);
			});

			return items.length > 0 ? items.concat(await getItems(token, page + 1)) : items;
		}

		function drawFolders(folders, items, parent = null) {
			let output = "";
			let filteredFolders = folders
				.filter((folder) => {
					if (folder.parent === parent) return true;
					if (folder.parent != undefined && folder.parent["$id"] === parent) return true;
					return false;
				})
				.sort((a, b) => a.title.localeCompare(b.title, "ru"));
			for (let folder of filteredFolders) {
				let foldersHTML = drawFolders(folders, items, folder["_id"]);
				let itemsHTML = drawItems(items, folder["_id"]);

				if (properties.show_galleries !== "on" && folder.view != "list") {
					continue;
				}

				let icon = `<svg class='icon'><use xlink:href="#default_collection"></use></svg>`;
				if (folder.cover != undefined && folder.cover.length > 0) {
					icon = `<img src='${folder.cover[0]}' class='icon'>`;
				}

				if (properties.show_folder_icons !== "on") {
					icon = "";
				}

				output += "<li class='folder'>";
				output += `<div><a href="https://app.raindrop.io/my/${folder["_id"]}" class='title'>${icon}<span class='title'>${folder.title}</span></a></div>`;
				if (folder.view == "list") output += itemsHTML;
				output += foldersHTML;
				output += "</li>";
			}
			return output != "" ? `<ul class="subfolders">${output}</ul>` : "";
		}

		function drawItems(items, parent) {
			let output = "";

			let filteredItmes = items
				.filter((item) => {
					return item.collectionId == parent; // && item.type != "image";
				})
				.sort((a, b) => a.title.localeCompare(b.title, "ru"));

			for (let item of filteredItmes) {
				let host = item.link.split("/")[2];
				let icon = `<img src='${faviconProvider}${host}' data-host="${item.link}" class="icon">`;
				if (properties.show_favicons !== "on") {
					icon = "";
				}

				let tags = new Set(item.tags);
				let hide = tags.intersection(properties.censored_tags).size > 0 ? "hide" : "";

				output += `<li class='item ${hide}' id='item_${item["_id"]}'>`;
				output += `<a href='${item.link}'>${icon}<span class='title'>${item.title}</span></a>`;
				output += "</li>";
			}

			return output != "" ? `<ul class="subitems">${output}</ul>` : "";
		}

		let cache = (await chrome.storage.local.get("cache"))["cache"] || null;
		if (cache != null) {
			app.querySelector(".tree").innerHTML = cache;
		}

		fetch("https://api.raindrop.io/rest/v1/collections/childrens", {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((resp) => resp.json())
			.then((json) => {
				getItems(token).then((items) => {
					//console.log("allitems", items, json.items);
					const filteredFolders = json.items; //.filter((z) => z.view == "list");

					const filteredItems = items.filter((z) => z.type != "image" && new Set(z.tags).intersection(properties.ignore_tags).size == 0);

					let html = drawFolders(filteredFolders, filteredItems);
					chrome.storage.local.set({ cache: html });

					app.querySelector(".tree").innerHTML = html;

					let icons = app.querySelectorAll(".tree img");

					for (let img of icons) {
						img.addEventListener("load", (event) => {
							if (img.naturalWidth < 2) img.src = `_favicon/?size=24&pageUrl=${img.dataset.host}`;
						});
					}

					initFuseSearch(filteredItems);
				});
			})
			.catch((error) => {
				console.error(error);
				//document.querySelector(".warning").innerHTML = error.message;
			});
	}

	//Инициируем полнотекстовый поиск
	function initFuseSearch(items) {
		const fuseOptions = {
			minMatchCharLength: 1,
			keys: ["abbr", "title", "link", "translate"],
			includeScore: true,
			threshold: 0.3,
			ignoreLocation: true,
		};
		const fuse = new Fuse(items, fuseOptions);

		searchFiled.addEventListener("input", (event) => {
			const tree = app.querySelector(".tree");
			let query = searchFiled.value;
			let allItems = tree.querySelectorAll(".item");
			let allFolders = tree.querySelectorAll(".folder");

			if (query == "") {
				tree.classList.remove("searching");
			} else {
				tree.classList.add("searching");
			}

			let results = fuse.search(query);

			for (let item of allItems) {
				item.classList.remove("matched");
			}

			for (let result of results) {
				if (result.score > 0.2) continue;
				let item = app.querySelector("#item_" + result.item["_id"]);
				if (item) item.classList.add("matched");
			}

			for (let folder of allFolders) {
				folder.classList.remove("matched");
				let matchedItem = folder.querySelector(".item.matched");
				if (matchedItem) {
					folder.classList.add("matched");
				}
			}
		});

		searchFiled.focus();
	}

	//навигация по закладкам
	document.addEventListener("keydown", (event) => {
		const isFiltered = app.querySelector(".tree").classList.contains("searching");
		const itemSelector = isFiltered ? ".item.matched>a" : ".item>a";
		const folderSelector = isFiltered ? ".folder.matched" : ".folder";
		const items = Array.from(app.querySelectorAll(itemSelector));
		const folders = Array.from(app.querySelectorAll(folderSelector));
		const currentItem = app.querySelector(itemSelector + ":focus");
		const currentItemIndex = currentItem ? items.indexOf(currentItem) : -1;
		const currentFolder = currentItem != null ? currentItem.closest(folderSelector) : null;
		const currentFolderIndex = currentFolder != null ? folders.indexOf(currentFolder) : -1;

		if (event.key == "Escape" && currentItemIndex > -1) {
			searchFiled.value = "";
			searchFiled.dispatchEvent(new Event("input", { bubbles: true }));
			searchFiled.focus();
		}

		if (items.length == 0) return;

		if (event.key == "ArrowDown" && currentItemIndex < items.length - 1) {
			event.preventDefault();
			items[currentItemIndex + 1].focus();
		}

		if (event.key == "ArrowUp") {
			event.preventDefault();
			if (currentItemIndex > 0) {
				items[currentItemIndex - 1].focus();
			} else {
				searchFiled.focus();
			}
		}

		if (currentItem != null) {
			if (event.key == "ArrowRight" && currentFolderIndex < folders.length - 1 && currentItemIndex < items.length - 1) {
				event.preventDefault();
				folders[currentFolderIndex + 1].querySelector(itemSelector).focus();
			}

			if (event.key == "ArrowLeft") {
				event.preventDefault();
				if (currentFolderIndex > 0) {
					let prevItem = folders[currentFolderIndex - 1].querySelector(itemSelector);
					if (prevItem != currentItem) {
						prevItem.focus();
					} else {
						items[currentItemIndex - 1].focus();
					}
				} else {
					searchFiled.focus();
				}
			}
		}
	});

	initStyle();

	if (properties.use_raindrop == "on" && token) {
		initRaindrop();
	} else {
		initLocalBookmarks();
	}

	//Отслеживание изменений настроек плагина
	chrome.storage.onChanged.addListener((changes, namespace) => {
		for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
			//console.log(`Storage key "${key}" in namespace "${namespace}" changed.`, `Old value was "${oldValue}", new value is "${newValue}".`);

			const keysToUpdateStyle = ["background_image", "background_position", "custom_css"];
			for (let updateKey of keysToUpdateStyle) {
				if (key == updateKey) {
					properties[updateKey] = newValue;
					initStyle();
				}
			}

			if (key == "dark_theme") {
				if (newValue == "on") {
					document.body.classList.add("dark");
				} else {
					document.body.classList.remove("dark");
				}
			}

			const keysToUpdateRaindrop = ["use_raindrop", "raindrop_api_key", "show_folder_icons", "show_favicons", "show_galleries", "censored_tags", "ignore_tags"];
			for (let updateKey of keysToUpdateRaindrop) {
				if (key == updateKey) {
					if ((key == "censored_tags" || key == "ignore_tags") && newValue != null) {
						properties[updateKey] = new Set(newValue.split(","));
					} else {
						properties[updateKey] = newValue;
					}

					if (properties.use_raindrop == "on" && token) {
						initRaindrop();
					} else {
						initLocalBookmarks();
					}
				}
			}
		}
	});

	function getAbbr(text) {
		let abbr = text.match(/[A-ZА-ЯЁ]/g);
		return abbr != null ? abbr.join("") : "";
	}

	//Перевод в другую раскладку клавиатуры, если забыл переключить
	function keyboardTranslate(input) {
		function charWeight(str, charTable) {
			return String(str)
				.split("")
				.reduce(function (acc, char) {
					return acc + (charTable.indexOf(char) > 0 ? 1 : 0);
				}, 0);
		}

		function charTranslate(str, src, dst) {
			return String(str)
				.split("")
				.map(function (inChar) {
					var srcIdx = src.indexOf(inChar),
						outChar;
					if (srcIdx >= 0) {
						outChar = dst[srcIdx];
					} else {
						outChar = inChar;
					}
					return outChar;
				})
				.join("");
		}

		let RU = 'ёЁ!"№;%:?йцукенгшщзхъфывапролджэячсмитьбю.ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭ/ЯЧСМИТЬБЮ,';
		let EN = "`~!@#$%^&qwertyuiop[]asdfghjkl;'zxcvbnm,./QWERTYUIOP{}ASDFGHJKL:\"|ZXCVBNM<>?";

		if (charWeight(input, EN) > charWeight(input, RU)) {
			return charTranslate(input, EN, RU);
		} else {
			return charTranslate(input, RU, EN);
		}
	}
}

init();
