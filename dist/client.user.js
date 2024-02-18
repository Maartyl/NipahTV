// ==UserScript==
// @name Nipah Chat client
// @namespace https://github.com/Xzensi/Nipah-Chat
// @version 1.0
// @author Xzensi
// @description Better Kick and 7TV emote integration for Kick chat.
// @match https://kick.com/*
// @require https://code.jquery.com/jquery-3.7.1.min.js
// @require https://cdn.jsdelivr.net/npm/fuse.js@7.0.0
// @resource KICK_CSS https://github.com/Xzensi/Nipah-Chat/raw/master/dist/kick.css
// @supportURL https://github.com/Xzensi/Nipah-Chat
// @homepageURL https://github.com/Xzensi/Nipah-Chat
// @downloadURL https://github.com/Xzensi/Nipah-Chat/raw/master/dist/client.user.js
// @grant unsafeWindow
// @grant GM_addStyle
// @grant GM_getResourceText
// @grant GM.setClipboard
// ==/UserScript==
"use strict";
(() => {
  // src/Logger.js
  var Logger = class {
    constructor() {
      this.prefix = "NIPAH";
      this.brandStyle = `background-color: #91152e; border-left-color: #660002;`;
      this.okStyle = `background-color: #178714; border-left-color: #186200;`;
      this.infoStyle = `background-color: #394adf; border-left-color: #1629d1;`;
      this.errorStyle = `background-color: #91152e; border-left-color: #660002;`;
      this.eventStyle = `background-color: #9d7a11; border-left-color: #6f4e00;`;
      this.extraMargin = (x = 0) => `margin-right: ${0.7 + x}em;`;
      this.tagStyle = `
			border-left: 0.3em solid white;
			vertical-align: middle;
			margin-right: 0.618em;
			font-size: 1.209em;
			padding: 0 0.618em;
			border-radius: 4px;
			font-weight: bold;
			color: white;
        `;
    }
    log(...args) {
      console.log(
        `%c${this.prefix}%cOK%c`,
        this.tagStyle + this.brandStyle,
        this.tagStyle + this.okStyle + this.extraMargin(1),
        "",
        ...args
      );
    }
    info(...args) {
      console.log(
        `%c${this.prefix}%cINFO%c`,
        this.tagStyle + this.brandStyle,
        this.tagStyle + this.infoStyle + this.extraMargin(),
        "",
        ...args
      );
    }
    error(...args) {
      console.error(
        `%c${this.prefix}%cERROR%c`,
        this.tagStyle + this.brandStyle,
        this.tagStyle + this.errorStyle + this.extraMargin(),
        "",
        ...args
      );
    }
    logEvent(event, ...args) {
      console.log(
        `%c${this.prefix}%cEVENT%c`,
        this.tagStyle + this.brandStyle,
        this.tagStyle + this.eventStyle + this.extraMargin(-0.595),
        "",
        event,
        ...args
      );
    }
  };

  // src/utils.js
  var logger = new Logger();
  var log = logger.log.bind(logger);
  var logEvent = logger.logEvent.bind(logger);
  var info = logger.info.bind(logger);
  var error2 = logger.error.bind(logger);
  var assertArgument = (arg, type) => {
    if (typeof arg !== type) {
      throw new Error(`Invalid argument, expected ${type} but got ${typeof arg}`);
    }
  };
  var assertArgDefined = (arg) => {
    if (typeof arg === "undefined") {
      throw new Error("Invalid argument, expected defined value");
    }
  };
  async function fetchJSON(url) {
    return new Promise((resolve, reject) => {
      fetch(url).then((res) => res.json()).then(resolve).catch(reject);
    });
  }
  function isEmpty(obj) {
    for (var x in obj) {
      return false;
    }
    return true;
  }

  // src/DTO.js
  var DTO = class {
    constructor(topic, data) {
      this.topic = topic;
      this.data = data;
    }
    setter(key, value) {
      throw new Error("Data transfer objects are immutable, setter not allowed.");
    }
  };

  // src/Publisher.js
  var Publisher = class {
    listeners = /* @__PURE__ */ new Map();
    firedEvents = /* @__PURE__ */ new Map();
    subscribe(event, callback, triggerOnExistingEvent = false) {
      assertArgument(event, "string");
      assertArgument(callback, "function");
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
      if (triggerOnExistingEvent && this.firedEvents.has(event)) {
        callback(this.firedEvents.get(event).data);
      }
    }
    publish(topic, data) {
      if (!topic)
        return error2("Invalid event topic, discarding event..");
      const dto = new DTO(topic, data);
      this.firedEvents.set(dto.topic, dto);
      logEvent(dto.topic);
      if (!this.listeners.has(dto.topic)) {
        return;
      }
      const listeners = this.listeners.get(dto.topic);
      for (const listener of listeners) {
        listener(dto.data);
      }
    }
  };

  // src/Providers/AbstractProvider.js
  var AbstractProvider = class _AbstractProvider {
    id = 0;
    constructor(datastore) {
      if (this.constructor == _AbstractProvider) {
        throw new Error("Class is of abstract type and can't be instantiated");
      }
      if (this.fetchEmotes === void 0) {
        throw new Error("Class is missing required method fetchEmotes");
      }
      if (this.id === void 0) {
        throw new Error("Class is missing required property id");
      }
      this.datastore = datastore;
    }
    async fetchEmotes() {
      throw new Error("Not yet implemented");
    }
    getRenderableEmote() {
      throw new Error("Not yet implemented");
    }
    getEmbeddableEmote() {
      throw new Error("Not yet implemented");
    }
  };

  // src/SlidingTimestampWindow.js
  var SlidingTimestampWindow = class {
    constructor(historyEntries) {
      this.timestampWindow = 14 * 24 * 60 * 60 * 1e3;
      this.entries = historyEntries || [];
      this.maxEntries = 384;
      setInterval(this.update.bind(this), Math.random() * 40 * 1e3 + 30 * 60 * 1e3);
      setTimeout(this.update.bind(this), (Math.random() * 40 + 30) * 1e3);
    }
    addEntry() {
      if (this.entries.length >= this.maxEntries) {
        let oldestIndex = 0;
        let oldestTimestamp = this.entries[0];
        for (let i = 1; i < this.entries.length; i++) {
          if (this.entries[i] < oldestTimestamp) {
            oldestIndex = i;
            oldestTimestamp = this.entries[i];
          }
        }
        this.entries[oldestIndex] = Date.now();
        return;
      }
      this.entries.push(Date.now());
    }
    update() {
      this.entries = this.entries.filter((entry) => entry > Date.now() - this.timestampWindow);
    }
    getTotal() {
      return this.entries.length;
    }
  };

  // src/EmoteDatastore.js
  var EmoteDatastore = class {
    emoteSets = [];
    emoteMap = /* @__PURE__ */ new Map();
    emoteNameMap = /* @__PURE__ */ new Map();
    emoteHistory = /* @__PURE__ */ new Map();
    // Map of pending history changes to be stored in localstorage
    pendingHistoryChanges = {};
    pendingNewEmoteHistory = false;
    fuse = new Fuse([], {
      includeScore: true,
      shouldSort: false,
      threshold: 0.4,
      keys: [{ name: "name" }]
    });
    constructor(eventBus, channelId) {
      this.eventBus = eventBus;
      this.channelId = channelId;
      this.loadDatabase();
      setInterval(() => {
        this.storeDatabase();
      }, 5 * 60 * 1e3);
      setInterval(() => this.storeDatabase(), 3 * 1e3);
    }
    loadDatabase() {
      info("Reading out localstorage..");
      const emoteHistory = localStorage.getItem(`nipah_${this.channelId}_emote_history`);
      if (!emoteHistory)
        return;
      const emoteIds = emoteHistory.split(",");
      this.emoteHistory = /* @__PURE__ */ new Map();
      for (const emoteId of emoteIds) {
        const history = localStorage.getItem(`nipah_${this.channelId}_emote_history_${emoteId}`);
        if (!history)
          continue;
        this.emoteHistory.set(emoteId, new SlidingTimestampWindow(history.split(",")));
      }
    }
    storeDatabase() {
      if (isEmpty(this.pendingHistoryChanges))
        return;
      for (const emoteId in this.pendingHistoryChanges) {
        const entries = this.emoteHistory.get(emoteId).entries;
        localStorage.setItem(`nipah_${this.channelId}_emote_history_${emoteId}`, entries);
      }
      this.pendingHistoryChanges = {};
      if (this.pendingNewEmoteHistory) {
        const emoteIdsWithHistory = Array.from(this.emoteHistory.keys());
        localStorage.setItem(`nipah_${this.channelId}_emote_history`, emoteIdsWithHistory);
        this.pendingNewEmoteHistory = false;
      }
    }
    registerEmoteSet(emoteSet) {
      for (const set of this.emoteSets) {
        if (set.id === emoteSet.id && set.provider === emoteSet.provider) {
          return;
        }
      }
      this.emoteSets.push(emoteSet);
      emoteSet.emotes.forEach((emote) => {
        if (!emote.id || typeof emote.id !== "string" || !emote.name || typeof emote.provider === "undefined") {
          return error2("Invalid emote data", emote);
        }
        if (this.emoteNameMap.has(emote.name)) {
          return log(`Duplicate emote ${emote.name}, skipping..`);
        }
        this.emoteMap.set("" + emote.id, emote);
        this.emoteNameMap.set(emote.name, emote);
        this.fuse.add(emote);
      });
      this.eventBus.publish("nipah.datastore.emotes.changed");
    }
    getEmote(emoteId) {
      return this.emoteMap.get(emoteId);
    }
    getEmoteHistoryCount(emoteId) {
      return this.emoteHistory.get(emoteId)?.getTotal() || 0;
    }
    registerEmoteEngagement(emoteId, historyEntries = null) {
      if (!emoteId)
        return error2("Undefined required emoteId argument");
      if (!this.emoteHistory.has(emoteId) || historyEntries) {
        this.emoteHistory.set(emoteId, new SlidingTimestampWindow(historyEntries));
        if (!historyEntries)
          this.pendingNewEmoteHistory = true;
      }
      this.pendingHistoryChanges[emoteId] = true;
      this.emoteHistory.get(emoteId).addEntry();
      this.eventBus.publish("nipah.datastore.emotes.history.changed", { emoteId });
    }
    searchEmotes(searchVal) {
      return this.fuse.search(searchVal).sort((a, b) => {
        const aHistory = (this.emoteHistory.get(a.item.id)?.getTotal() || 0) + 1;
        const bHistory = (this.emoteHistory.get(b.item.id)?.getTotal() || 0) + 1;
        const aTotalScore = a.score - 1 - 1 / bHistory;
        const bTotalScore = b.score - 1 - 1 / aHistory;
        if (aTotalScore < bTotalScore)
          return -1;
        if (aTotalScore > bTotalScore)
          return 1;
        return 0;
      });
    }
  };

  // src/EmotesManager.js
  var EmotesManager = class {
    providers = /* @__PURE__ */ new Map();
    loaded = false;
    constructor(eventBus, channelId) {
      this.eventBus = eventBus;
      this.datastore = new EmoteDatastore(eventBus, channelId);
    }
    registerProvider(providerConstructor) {
      if (!(providerConstructor.prototype instanceof AbstractProvider)) {
        return error2("Invalid provider constructor", providerConstructor);
      }
      const provider = new providerConstructor(this.datastore);
      this.providers.set(provider.id, provider);
    }
    async loadProviderEmotes(channelData) {
      const { datastore, providers, eventBus } = this;
      const fetchEmoteProviderPromises = [];
      providers.forEach((provider) => {
        fetchEmoteProviderPromises.push(
          provider.fetchEmotes(channelData).then((emoteSets) => {
            for (const emoteSet of emoteSets) {
              datastore.registerEmoteSet(emoteSet);
            }
          })
        );
      });
      info("Indexing emote providers..");
      Promise.allSettled(fetchEmoteProviderPromises).then(() => {
        this.loaded = true;
        eventBus.publish("nipah.providers.loaded");
      });
    }
    getEmote(emoteId) {
      return this.datastore.getEmote(emoteId);
    }
    getEmoteSrc(emoteId) {
      const emote = this.getEmote(emoteId);
      if (!emote)
        return error2("Emote not found");
      return this.providers.get(emote.provider).getEmoteSrc(emote);
    }
    getEmoteSets() {
      return this.datastore.emoteSets;
    }
    getEmoteHistory() {
      return this.datastore.emoteHistory;
    }
    getEmoteHistoryCount(emoteId) {
      return this.datastore.getEmoteHistoryCount(emoteId);
    }
    getRenderableEmote(emote) {
      if (typeof emote !== "object") {
        emote = this.getEmote(emote);
        if (!emote)
          return error2("Emote not found");
      }
      const provider = this.providers.get(emote.provider);
      return provider.getRenderableEmote(emote);
    }
    getEmoteEmbeddable(emoteId) {
      const emote = this.getEmote(emoteId);
      if (!emote)
        return error2("Emote not found");
      const provider = this.providers.get(emote.provider);
      return provider.getEmbeddableEmote(emote);
    }
    registerEmoteEngagement(emoteId) {
      this.datastore.registerEmoteEngagement(emoteId);
    }
    search(searchVal) {
      return this.datastore.searchEmotes(searchVal);
    }
  };

  // src/UserInterface/Components/AbstractComponent.js
  var AbstractComponent = class {
    // Method to render the component
    render() {
      throw new Error("render() method must be implemented");
    }
    // Method to attach event handlers
    attachEventHandlers() {
      throw new Error("attachEventHandlers() method must be implemented");
    }
    // Method to initialize the component
    init() {
      this.render();
      this.attachEventHandlers();
      return this;
    }
  };

  // src/UserInterface/Components/EmoteMenuButton.js
  var EmoteMenuButton = class extends AbstractComponent {
    constructor({ ENV_VARS, eventBus }) {
      super();
      this.ENV_VARS = ENV_VARS;
      this.eventBus = eventBus;
    }
    render() {
      const basePath = this.ENV_VARS.RESOURCE_ROOT;
      this.$element = $(`
            <div class="nipah_client_footer">
                <img class="footer_logo_btn" srcset="${basePath}/dist/logo_1.png 1x, ${basePath}/dist/logo_1@2x.png 2x, ${basePath}/dist/logo_1@3x.png 3x" draggable="false" alt="Nipah">
            </div>
        `);
      $("#chatroom-footer .send-row").prepend(this.$element);
    }
    attachEventHandlers() {
      $(".footer_logo_btn", this.$element).click(() => {
        this.eventBus.publish("nipah.ui.footer.click");
      });
    }
  };

  // src/UserInterface/Components/EmoteMenu.js
  var EmoteMenu = class extends AbstractComponent {
    toggleStates = {};
    isShowing = false;
    activePanel = "emotes";
    panels = {};
    sidebarMap = /* @__PURE__ */ new Map();
    constructor({ eventBus, settingsManager, emotesManager }) {
      super();
      this.eventBus = eventBus;
      this.settingsManager = settingsManager;
      this.emotesManager = emotesManager;
    }
    render() {
      this.$container = $(`
            <div class="nipah__emote-menu" style="display: none">
                <div class="nipah__emote-menu__header">
					<div class="nipah__emote-menu__search">
						<div class="nipah__emote-menu__search__icon">
							<svg width="15" height="15" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><path d="M11.3733 5.68667C11.3733 6.94156 10.966 8.10077 10.2797 9.04125L13.741 12.5052C14.0827 12.8469 14.0827 13.4019 13.741 13.7437C13.3992 14.0854 12.8442 14.0854 12.5025 13.7437L9.04125 10.2797C8.10077 10.9687 6.94156 11.3733 5.68667 11.3733C2.54533 11.3733 0 8.828 0 5.68667C0 2.54533 2.54533 0 5.68667 0C8.828 0 11.3733 2.54533 11.3733 5.68667ZM5.68667 9.62359C7.86018 9.62359 9.62359 7.86018 9.62359 5.68667C9.62359 3.51316 7.86018 1.74974 5.68667 1.74974C3.51316 1.74974 1.74974 3.51316 1.74974 5.68667C1.74974 7.86018 3.51316 9.62359 5.68667 9.62359Z"></path></svg>
						</div>
						<input type="text" tabindex="0" placeholder="Search emote..">
					</div>
                </div>
                <div class="nipah__emote-menu__body">
                    <div class="nipah__emote-menu__scrollable">
						<div class="nipah__emote-menu__panel__emotes"></div>
						<div class="nipah__emote-menu__panel__search" display="none"></div>
					</div>
                    <div class="nipah__emote-menu__sidebar">
						<div class="nipah__emote-menu__sidebar__sets"></div>
						<div class="nipah__emote-menu__settings-btn">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
								<path fill="currentColor" d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64z" />
							</svg>
						</div>
					</div>
                </div>
            </div>
        `);
      this.$searchInput = $(".nipah__emote-menu__search input", this.$container);
      this.$scrollable = $(".nipah__emote-menu__scrollable", this.$container);
      this.$settingsBtn = $(".nipah__emote-menu__settings-btn", this.$container);
      this.$sidebarSets = $(".nipah__emote-menu__sidebar__sets", this.$container);
      this.panels.$emotes = $(".nipah__emote-menu__panel__emotes", this.$container);
      this.panels.$search = $(".nipah__emote-menu__panel__search", this.$container);
      $("body").append(this.$container);
    }
    attachEventHandlers() {
      const { eventBus, settingsManager } = this;
      this.$scrollable.on("click", "img", (evt) => {
        const emoteId = evt.target.getAttribute("data-emote-id");
        if (!emoteId)
          return error2("Invalid emote id");
        eventBus.publish("nipah.ui.emote.click", { emoteId });
        this.toggleShow();
      });
      this.$scrollable.on("mouseenter", "img", (evt) => {
        if (this.$tooltip)
          this.$tooltip.remove();
        const emoteId = evt.target.getAttribute("data-emote-id");
        if (!emoteId)
          return;
        const emote = this.emotesManager.getEmote(emoteId);
        if (!emote)
          return;
        const imageInTooltop = settingsManager.getSetting("shared.chat.tooltips.images");
        const $tooltip = $(`
					<div class="nipah__emote-tooltip ${imageInTooltop ? "nipah__emote-tooltip--has-image" : ""}">
						${imageInTooltop ? this.emotesManager.getRenderableEmote(emote) : ""}
						<span>${emote.name}</span>
					</div>`).appendTo(document.body);
        const rect = evt.target.getBoundingClientRect();
        $tooltip.css({
          top: rect.top - rect.height / 2,
          left: rect.left + rect.width / 2
        });
        this.$tooltip = $tooltip;
      }).on("mouseleave", "img", (evt) => {
        if (this.$tooltip)
          this.$tooltip.remove();
      });
      this.$searchInput.on("input", this.handleSearchInput.bind(this));
      this.$settingsBtn.on("click", () => {
        eventBus.publish("nipah.ui.settings.toggle_show");
      });
      eventBus.subscribe("nipah.providers.loaded", this.renderEmotes.bind(this), true);
      eventBus.subscribe("nipah.ui.footer.click", this.toggleShow.bind(this));
      $(document).on("keydown", (evt) => {
        if (evt.which === 27)
          this.toggleShow(false);
      });
      $(document).on("keydown", (evt) => {
        if (evt.ctrlKey && evt.keyCode === 32) {
          this.toggleShow();
        }
      });
    }
    handleSearchInput(evt) {
      const searchVal = evt.target.value;
      if (searchVal.length) {
        this.switchPanel("search");
      } else {
        this.switchPanel("emotes");
      }
      const emotesResult = this.emotesManager.search(searchVal.substring(0, 10));
      log(`Searching for emotes, found ${emotesResult.length} matches"`);
      this.panels.$search.empty();
      let maxResults = 75;
      for (const emoteResult of emotesResult) {
        if (maxResults-- <= 0)
          break;
        this.panels.$search.append(this.emotesManager.getRenderableEmote(emoteResult.item));
      }
    }
    switchPanel(panel) {
      if (this.activePanel === panel)
        return;
      if (this.activePanel === "search") {
        this.panels.$search.hide();
      } else if (this.activePanel === "emotes") {
        this.panels.$emotes.hide();
      }
      if (panel === "search") {
        this.panels.$search.show();
      } else if (panel === "emotes") {
        this.panels.$emotes.show();
      }
      this.activePanel = panel;
    }
    renderEmotes() {
      log("Rendering emotes in modal");
      const { emotesManager } = this;
      const $emotesPanel = this.panels.$emotes;
      const $sidebarSets = this.$sidebarSets;
      $sidebarSets.empty();
      $emotesPanel.empty();
      const emoteSets = this.emotesManager.getEmoteSets();
      const orderedEmoteSets = Array.from(emoteSets).sort((a, b) => a.order_index > b.order_index);
      for (const emoteSet of orderedEmoteSets) {
        const sortedEmotes = emoteSet.emotes.sort((a, b) => a.width > b.width);
        const sidebarIcon = $(`<img data-id="${emoteSet.id}" src="${emoteSet.icon}">`).appendTo($sidebarSets);
        this.sidebarMap.set(emoteSet.id, sidebarIcon[0]);
        $emotesPanel.append(`
                <div class="nipah__emote-set" data-id="${emoteSet.id}">
                    <div class="nipah__emote-set__header">
						<img src="${emoteSet.icon}">
						<span>${emoteSet.name}</span>
						<div class="nipah_chevron">
                            <svg width="1em" height="0.6666em" viewBox="0 0 9 6" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.221974 4.46565L3.93498 0.251908C4.0157 0.160305 4.10314 0.0955723 4.19731 0.0577097C4.29148 0.0192364 4.39238 5.49454e-08 4.5 5.3662e-08C4.60762 5.23786e-08 4.70852 0.0192364 4.80269 0.0577097C4.89686 0.0955723 4.9843 0.160305 5.06502 0.251908L8.77803 4.46565C8.92601 4.63359 9 4.84733 9 5.10687C9 5.36641 8.92601 5.58015 8.77803 5.74809C8.63005 5.91603 8.4417 6 8.213 6C7.98431 6 7.79596 5.91603 7.64798 5.74809L4.5 2.17557L1.35202 5.74809C1.20404 5.91603 1.0157 6 0.786996 6C0.558296 6 0.369956 5.91603 0.221974 5.74809C0.0739918 5.58015 6.39938e-08 5.36641 6.08988e-08 5.10687C5.78038e-08 4.84733 0.0739918 4.63359 0.221974 4.46565Z"></path></svg>
                        </div>
                    </div>
                    <div class="nipah__emote-set__emotes">
                    ${sortedEmotes.map((emote) => emotesManager.getRenderableEmote(emote)).join("")}
                    </div>
                </div>
            `);
      }
      const sidebarIcons = $("img", this.$sidebarSets);
      sidebarIcons.on("click", (evt) => {
        const scrollableEl = this.$scrollable[0];
        const emoteSetId = evt.target.getAttribute("data-id");
        const emoteSetEl = $(`.nipah__emote-set[data-id="${emoteSetId}"]`, this.$container)[0];
        scrollableEl.scrollTo({
          top: emoteSetEl.offsetTop - 55,
          behavior: "smooth"
        });
      });
      const observer = new IntersectionObserver(
        (entries, observer2) => {
          entries.forEach((entry) => {
            const emoteSetId = entry.target.getAttribute("data-id");
            const sidebarIcon = this.sidebarMap.get(emoteSetId);
            sidebarIcon.style.backgroundColor = `rgba(255, 255, 255, ${entry.intersectionRect.height / this.scrollableHeight / 7})`;
          });
        },
        {
          root: this.$scrollable[0],
          rootMargin: "0px",
          threshold: (() => {
            let thresholds = [];
            let numSteps = 100;
            for (let i = 1; i <= numSteps; i++) {
              let ratio = i / numSteps;
              thresholds.push(ratio);
            }
            thresholds.push(0);
            return thresholds;
          })()
        }
      );
      const emoteSetEls = $(".nipah__emote-set", $emotesPanel);
      for (const emoteSetEl of emoteSetEls)
        observer.observe(emoteSetEl);
    }
    handleOutsideModalClick(evt) {
      const containerEl = this.$container[0];
      const withinComposedPath = evt.composedPath().includes(containerEl);
      if (!withinComposedPath)
        this.toggleShow(false);
    }
    toggleShow(bool) {
      if (bool === this.isShowing)
        return;
      this.isShowing = !this.isShowing;
      if (this.isShowing) {
        setTimeout(() => {
          this.$searchInput[0].focus();
          this.closeModalClickListenerHandle = this.handleOutsideModalClick.bind(this);
          window.addEventListener("click", this.closeModalClickListenerHandle);
        });
      } else {
        window.removeEventListener("click", this.closeModalClickListenerHandle);
      }
      this.$container.toggle(this.isShowing);
      this.scrollableHeight = this.$scrollable.height();
    }
  };

  // src/UserInterface/Components/QuickEmotesHolder.js
  var QuickEmotesHolder = class extends AbstractComponent {
    // The sorting list shadow reflects the order of emotes in this.$element
    sortingList = [];
    constructor({ eventBus, emotesManager }) {
      super();
      this.eventBus = eventBus;
      this.emotesManager = emotesManager;
    }
    render() {
      this.$element = $(`<div class="nipah_client_quick_emotes_holder"></div>`);
      const $oldEmotesHolder = $("#chatroom-footer .quick-emotes-holder");
      $oldEmotesHolder.after(this.$element);
      $oldEmotesHolder.remove();
    }
    attachEventHandlers() {
      this.$element.on("click", "img", (evt) => {
        const emoteId = evt.target.getAttribute("data-emote-id");
        if (!emoteId)
          return error2("Invalid emote id");
        this.handleEmoteClick(emoteId, !!evt.ctrlKey);
      });
      this.eventBus.subscribe("nipah.providers.loaded", this.loadEmotes.bind(this), true);
      this.eventBus.subscribe("nipah.datastore.emotes.history.changed", this.handleEmotesHistoryChanged.bind(this));
    }
    loadEmotes() {
      const { emotesManager } = this;
      const emoteHistory = emotesManager.getEmoteHistory();
      if (emoteHistory.size) {
        for (const [emoteId, history] of emoteHistory) {
          this.updateEmoteHistory(emoteId);
        }
      }
    }
    handleEmoteClick(emoteId, sendImmediately = false) {
      assertArgDefined(emoteId);
      const { emotesManager } = this;
      const emote = emotesManager.getEmote(emoteId);
      if (!emote)
        return error2("Invalid emote");
      this.eventBus.publish("nipah.ui.emote.click", { emoteId, sendImmediately });
    }
    /**
     * When an emote is used, it's history count is updated and the emote is moved to the correct position
     *  in the quick emote holder according to the updated history count.
     */
    handleEmotesHistoryChanged({ emoteId }) {
      if (!emoteId)
        return error2("Invalid emote id");
      this.updateEmoteHistory(emoteId);
    }
    updateEmoteHistory(emoteId) {
      const { emotesManager } = this;
      const emote = emotesManager.getEmote(emoteId);
      if (!emote)
        return error2("Invalid emote");
      const emoteInSortingListIndex = this.sortingList.findIndex((entry) => entry.id === emoteId);
      if (emoteInSortingListIndex !== -1) {
        const emoteToSort = this.sortingList[emoteInSortingListIndex];
        emoteToSort.$emote.remove();
        this.sortingList.splice(emoteInSortingListIndex, 1);
        const insertIndex = this.getSortedEmoteIndex(emoteId);
        if (insertIndex !== -1) {
          this.sortingList.splice(insertIndex, 0, emoteToSort);
          this.$element.children().eq(insertIndex).before(emoteToSort.$emote);
        } else {
          this.sortingList.push(emoteToSort);
          this.$element.append(emoteToSort.$emote);
        }
      } else {
        const $emotePartial = $(emotesManager.getRenderableEmote(emoteId));
        const insertIndex = this.getSortedEmoteIndex(emoteId);
        if (insertIndex !== -1) {
          this.sortingList.splice(insertIndex, 0, { id: emoteId, $emote: $emotePartial });
          this.$element.children().eq(insertIndex).before($emotePartial);
        } else {
          this.sortingList.push({ id: emoteId, $emote: $emotePartial });
          this.$element.append($emotePartial);
        }
      }
    }
    getSortedEmoteIndex(emoteId) {
      const { emotesManager } = this;
      const emoteHistoryCount = emotesManager.getEmoteHistoryCount(emoteId);
      return this.sortingList.findIndex((entry) => {
        return emotesManager.getEmoteHistoryCount(entry.id) < emoteHistoryCount;
      });
    }
  };

  // src/UserInterface/AbstractUserInterface.js
  var AbstractUserInterface = class {
    /**
     * @param {EventBus} eventBus
     * @param {object} deps
     */
    constructor({ ENV_VARS, eventBus, settingsManager, emotesManager }) {
      if (ENV_VARS === void 0)
        throw new Error("ENV_VARS is required");
      if (eventBus === void 0)
        throw new Error("eventBus is required");
      if (emotesManager === void 0)
        throw new Error("emotesManager is required");
      if (settingsManager === void 0)
        throw new Error("settingsManager is required");
      this.ENV_VARS = ENV_VARS;
      this.eventBus = eventBus;
      this.settingsManager = settingsManager;
      this.emotesManager = emotesManager;
    }
    loadInterface() {
      throw new Error("loadInterface() not implemented");
    }
  };

  // src/UserInterface/Caret.js
  var Caret = class {
    static collapseToEndOfNode(selection, range, node) {
      const newRange = range.cloneRange();
      newRange.setStartAfter(node);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      selection.collapseToEnd();
    }
    static hasNonWhitespaceCharacterBeforeCaret() {
      const selection = window.getSelection();
      const range = selection.anchorNode ? selection.getRangeAt(0) : null;
      if (!range)
        return false;
      let textContent, offset;
      const caretIsInTextNode = range.startContainer.nodeType === Node.TEXT_NODE;
      if (caretIsInTextNode) {
        textContent = range.startContainer.textContent;
        offset = range.startOffset - 1;
      } else {
        const childNode = range.startContainer.childNodes[range.startOffset - 1];
        if (!childNode)
          return false;
        if (childNode.nodeType === Node.TEXT_NODE) {
          textContent = childNode.textContent;
          offset = textContent.length - 1;
        } else {
          return false;
        }
      }
      if (!textContent)
        return false;
      const leadingChar = textContent[offset];
      return leadingChar && leadingChar !== " ";
    }
    static hasNonWhitespaceCharacterAfterCaret() {
      const selection = window.getSelection();
      const range = selection.anchorNode ? selection.getRangeAt(0) : null;
      if (!range)
        return false;
      let textContent, offset;
      const caretIsInTextNode = range.startContainer.nodeType === Node.TEXT_NODE;
      if (caretIsInTextNode) {
        textContent = range.startContainer.textContent;
        offset = range.startOffset;
      } else {
        const childNode = range.startContainer.childNodes[range.startOffset];
        if (!childNode)
          return false;
        if (childNode.nodeType === Node.TEXT_NODE) {
          textContent = childNode.textContent;
          offset = textContent.length - 1;
        } else {
          return false;
        }
      }
      if (!textContent)
        return false;
      const trailingChar = textContent[offset];
      return trailingChar && trailingChar !== " ";
    }
    static insertNodeAtCaret(range, node) {
      if (!node.nodeType || node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) {
        return error("Invalid node type", node);
      }
      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        range.insertNode(node);
      } else {
        if (range.startOffset - 1 === -1) {
          range.startContainer.prepend(node);
          return;
        }
        const childNode = range.startContainer.childNodes[range.startOffset - 1];
        if (!childNode) {
          range.startContainer.appendChild(node);
          return;
        }
        childNode.after(node);
      }
    }
  };

  // src/UserInterface/KickUserInterface.js
  var KickUserInterface = class extends AbstractUserInterface {
    elm = {
      $textField: $("#message-input"),
      $submitButton: $("#chatroom-footer button.base-button")
    };
    constructor(deps) {
      super(deps);
    }
    loadInterface() {
      info("Creating user interface..");
      const { ENV_VARS, eventBus, settingsManager, emotesManager } = this;
      const emoteMenu = new EmoteMenu({ eventBus, emotesManager, settingsManager }).init();
      const emoteMenuButton = new EmoteMenuButton({ ENV_VARS, eventBus }).init();
      const quickEmotesHolder = new QuickEmotesHolder({ eventBus, emotesManager }).init();
      eventBus.subscribe("nipah.ui.emote.click", ({ emoteId, sendImmediately }) => {
        if (sendImmediately) {
          this.sendEmoteToChat(emoteId);
        } else {
          this.insertEmoteInChat(emoteId);
        }
      });
      this.elm.$textField.on("input", this.handleInput.bind(this));
      this.elm.$textField.on("click", () => emoteMenu.toggleShow(false));
      if (settingsManager.getSetting("shared.chat.appearance.alternating_background")) {
        $("#chatroom").addClass("nipah__alternating-background");
      }
      eventBus.subscribe("nipah.settings.change.shared.chat.appearance.alternating_background", (value) => {
        $("#chatroom").toggleClass("nipah__alternating-background", value);
      });
      const seperatorSettingVal = settingsManager.getSetting("shared.chat.appearance.seperators");
      if (seperatorSettingVal && seperatorSettingVal !== "none") {
        $("#chatroom").addClass(`nipah__seperators-${seperatorSettingVal}`);
      }
      eventBus.subscribe("nipah.settings.change.shared.chat.appearance.seperators", ({ value, prevValue }) => {
        if (prevValue !== "none")
          $("#chatroom").removeClass(`nipah__seperators-${prevValue}`);
        if (!value || value === "none")
          return;
        $("#chatroom").addClass(`nipah__seperators-${value}`);
      });
    }
    handleInput(evt) {
      const textFieldEl = this.elm.$textField[0];
      if (textFieldEl.innerHTML.includes("<br>")) {
        textFieldEl.innerHTML = textFieldEl.innerHTML.replaceAll("<br>", "");
      }
    }
    // Sends emote to chat and restores previous message
    sendEmoteToChat(emoteId) {
      assertArgDefined(emoteId);
      const textFieldEl = this.elm.$textField[0];
      const submitButton = this.elm.$submitButton[0];
      const oldMessage = textFieldEl.innerHTML;
      textFieldEl.innerHTML = "";
      this.insertEmoteInChat(emoteId);
      textFieldEl.dispatchEvent(new Event("input"));
      submitButton.dispatchEvent(new Event("click"));
      textFieldEl.innerHTML = oldMessage;
      textFieldEl.dispatchEvent(new Event("input"));
    }
    insertEmoteInChat(emoteId) {
      assertArgDefined(emoteId);
      const { emotesManager } = this;
      emotesManager.registerEmoteEngagement(emoteId);
      const emoteEmbedding = emotesManager.getEmoteEmbeddable(emoteId);
      if (!emoteEmbedding)
        return error2("Invalid emote embed");
      let embedNode;
      const isEmbedHtml = emoteEmbedding[0] === "<" && emoteEmbedding[emoteEmbedding.length - 1] === ">";
      if (isEmbedHtml) {
        const nodes = jQuery.parseHTML(emoteEmbedding);
        if (!nodes || !nodes.length || nodes.length > 1)
          return error2("Invalid embedding", emoteEmbedding);
        embedNode = nodes[0];
      } else {
        const needPaddingBefore = Caret.hasNonWhitespaceCharacterBeforeCaret();
        const needPaddingAfter = Caret.hasNonWhitespaceCharacterAfterCaret();
        const paddedEmbedding = (needPaddingBefore ? " " : "") + emoteEmbedding + (needPaddingAfter ? " " : "");
        embedNode = document.createTextNode(paddedEmbedding);
      }
      this.insertNodeInChat(embedNode);
    }
    insertNodeInChat(embedNode) {
      log(`Inserting node in chat`);
      if (embedNode.nodeType !== Node.TEXT_NODE && embedNode.nodeType !== Node.ELEMENT_NODE) {
        return error2("Invalid node type", embedNode);
      }
      const textFieldEl = this.elm.$textField[0];
      const selection = window.getSelection();
      const range = selection.anchorNode ? selection.getRangeAt(0) : null;
      if (range) {
        const caretIsInTextField = range.commonAncestorContainer === textFieldEl || range.commonAncestorContainer?.parentElement === textFieldEl;
        if (caretIsInTextField) {
          Caret.insertNodeAtCaret(range, embedNode);
        } else {
          textFieldEl.appendChild(embedNode);
        }
        Caret.collapseToEndOfNode(selection, range, embedNode);
      } else {
        textFieldEl.appendChild(embedNode);
      }
      textFieldEl.normalize();
      textFieldEl.dispatchEvent(new Event("input"));
      textFieldEl.focus();
    }
  };

  // src/constants.js
  var PLATFORM_ENUM = {
    NULL: 0,
    KICK: 1,
    TWITCH: 2,
    YOUTUBE: 3,
    SEVENTV: 4
  };

  // src/Providers/KickProvider.js
  var KickProvider = class extends AbstractProvider {
    id = PLATFORM_ENUM.KICK;
    status = "unloaded";
    constructor(datastore) {
      super(datastore);
    }
    async fetchEmotes({ kick_channel_id, kick_channel_name }) {
      if (!kick_channel_id)
        return error2("Missing channel id for Kick provider");
      if (!kick_channel_name)
        return error2("Missing channel name for Kick provider");
      info("Fetching emote data from Kick..");
      const data = await fetchJSON(`https://kick.com/emotes/${kick_channel_name}`);
      const dataFiltered = data.filter((entry) => entry.id === kick_channel_id || entry.id === "Global");
      const emoteSets = [];
      for (const dataSet of dataFiltered) {
        const { emotes, subscription_enabled } = dataSet;
        const emotesFiltered = emotes.filter(
          (emote) => !emote.subscription_enabled || emote.subscribers_only && subscription_enabled
        );
        const emotesMapped = emotesFiltered.map((emote) => ({
          id: "" + emote.id,
          name: emote.name,
          provider: PLATFORM_ENUM.KICK,
          width: 32,
          size: 1
        }));
        const emoteSetIcon = dataSet?.user?.profile_pic || "https://kick.com/favicon.ico";
        const emoteSetName = dataSet.user ? `${dataSet.user.username}'s Emotes` : `${dataSet.name} Emotes`;
        emoteSets.push({
          provider: this.id,
          order_index: dataSet.id === "Global" ? 5 : 1,
          name: emoteSetName,
          emotes: emotesMapped,
          icon: emoteSetIcon,
          id: "" + dataSet.id
        });
      }
      if (!emoteSets.length) {
        log("No emotes found on Kick provider");
        this.status = "no_emotes_found";
        return [];
      }
      if (emoteSets.length > 1) {
        log(`Fetched ${emoteSets.length} emote sets from Kick`);
      } else {
        log(`Fetched 1 emote set from Kick`);
      }
      this.status = "loaded";
      return emoteSets;
    }
    getRenderableEmote(emote) {
      const srcset = `https://files.kick.com/emotes/${emote.id}/fullsize 1x`;
      return `
			<img class="nipah_emote" tabindex="0" size="1" data-emote-id="${emote.id}" alt="${emote.name}" srcset="${srcset}" loading="lazy" decoding="async" draggable="false">
		`;
    }
    getEmbeddableEmote(emote) {
      const src = `https://files.kick.com/emotes/${emote.id}/fullsize`;
      return `<img :data-emote-name="${emote.name}" class="gc-emote-c" data-emote-id="${emote.id}" src="${src}">`;
    }
    getEmoteSrc(emote) {
      return `https://files.kick.com/emotes/${emote.id}/fullsize`;
    }
  };

  // src/Providers/SevenTVProvider.js
  var SevenTVProvider = class extends AbstractProvider {
    id = PLATFORM_ENUM.SEVENTV;
    status = "unloaded";
    constructor(datastore) {
      super(datastore);
    }
    async fetchEmotes({ kick_user_id }) {
      info("Fetching emote data from SevenTV..");
      if (!kick_user_id)
        return error2("Missing kick channel id for SevenTV provider.");
      const data = await fetchJSON(`https://7tv.io/v3/users/KICK/${kick_user_id}`);
      if (!data.emote_set || !data.emote_set.emotes.length) {
        log("No emotes found on SevenTV provider");
        this.status = "no_emotes_found";
        return [];
      }
      const emotesMapped = data.emote_set.emotes.map((emote) => {
        const file = emote.data.host.files[0];
        let size;
        switch (true) {
          case file.width > 74:
            size = 4;
            break;
          case file.width > 53:
            size = 3;
            break;
          case file.width > 32:
            size = 2;
            break;
          default:
            size = 1;
        }
        return {
          id: "" + emote.id,
          name: emote.name,
          provider: PLATFORM_ENUM.SEVENTV,
          width: file.width,
          size
        };
      });
      log(`Fetched 1 emote set from SevenTV.`);
      this.status = "loaded";
      return [
        {
          provider: this.id,
          order_index: 2,
          name: data.emote_set.name,
          emotes: emotesMapped,
          icon: data.emote_set?.user?.avatar_url || "https://7tv.app/favicon.ico",
          id: "" + data.emote_set.id
        }
      ];
    }
    getRenderableEmote(emote) {
      const srcset = `https://cdn.7tv.app/emote/${emote.id}/1x.avif 1x, https://cdn.7tv.app/emote/${emote.id}/2x.avif 2x, https://cdn.7tv.app/emote/${emote.id}/3x.avif 3x, https://cdn.7tv.app/emote/${emote.id}/4x.avif 4x`;
      return `
			<img class="nipah_emote" tabindex="0" size="${emote.size}" data-emote-id="${emote.id}" alt="${emote.name}" srcset="${srcset}" loading="lazy" decoding="async" draggable="false">
		`;
    }
    getEmbeddableEmote(emote) {
      return emote.name;
    }
    getEmoteSrc(emote) {
      return `https://cdn.7tv.app/emote/${emote.id}/4x.avif`;
    }
  };

  // src/UserInterface/Components/Modals/AbstractModal.js
  var AbstractModal = class extends AbstractComponent {
    event = new EventTarget();
    constructor(className) {
      super();
      this.className = className;
    }
    init() {
      super.init();
    }
    // Renders the modal container, header and body
    render() {
      this.$modal = $(`
            <div class="nipah__modal ${this.className ? `nipah__${this.className}-modal` : ""}">
                <div class="nipah__modal__header">
                    <h3 class="nipah__modal__title"></h3>
                    <button class="nipah__modal__close-btn">\u{1F7A8}</button>
                </div>
                <div class="nipah__modal__body"></div>
            </div>
        `);
      this.$modalHeader = this.$modal.find(".nipah__modal__header");
      this.$modalBody = this.$modal.find(".nipah__modal__body");
      this.$modalClose = this.$modalHeader.find(".nipah__modal__close-btn");
      $("body").append(this.$modal);
      this.centerModal();
    }
    // Attaches event handlers for the modal
    attachEventHandlers() {
      this.$modalClose.on("click", () => {
        this.destroy();
        this.event.dispatchEvent(new Event("close"));
      });
      this.$modalHeader.on("mousedown", this.handleModalDrag.bind(this));
      $(window).on("resize", this.centerModal.bind(this));
    }
    destroy() {
      this.$modal.remove();
    }
    centerModal() {
      const windowHeight = $(window).height();
      const windowWidth = $(window).width();
      this.$modal.css({
        left: windowWidth / 2,
        top: windowHeight / 2
      });
    }
    handleModalDrag(evt) {
      const $modal = this.$modal;
      const modalOffset = $modal.offset();
      const offsetX = evt.pageX - modalOffset.left;
      const offsetY = evt.pageY - modalOffset.top;
      const windowHeight = $(window).height();
      const windowWidth = $(window).width();
      const modalWidth = $modal.width();
      const modalHeight = $modal.height();
      const handleDrag = (evt2) => {
        let x = evt2.pageX - offsetX;
        let y = evt2.pageY - offsetY;
        if (x < 0)
          x = 0;
        if (y < 0)
          y = 0;
        if (x + modalWidth > windowWidth)
          x = windowWidth - modalWidth;
        if (y + modalHeight > windowHeight)
          y = windowHeight - modalHeight;
        $modal.offset({
          left: x,
          top: y
        });
      };
      const handleDragEnd = () => {
        $(document).off("mousemove", handleDrag);
        $(document).off("mouseup", handleDragEnd);
      };
      $(document).on("mousemove", handleDrag);
      $(document).on("mouseup", handleDragEnd);
    }
  };

  // src/UserInterface/Components/CheckboxComponent.js
  var CheckboxComponent = class extends AbstractComponent {
    event = new EventTarget();
    constructor(id, label, checked = false) {
      super();
      this.id = id;
      this.label = label;
      this.checked = checked;
    }
    render() {
      this.$element = $(`
            <div class="nipah__checkbox">
                <input type="checkbox" id="${this.id}" ${this.checked ? "checked" : ""}>
                <label for="${this.id}">${this.label}</label>
            </div>
        `);
    }
    attachEventHandlers() {
      this.$element.find("input").on("change", (e) => {
        this.checked = e.target.checked;
        this.event.dispatchEvent(new Event("change"));
      });
    }
    getValue() {
      return this.checked;
    }
  };

  // src/UserInterface/Components/ColorComponent.js
  var ColorComponent = class extends AbstractComponent {
    event = new EventTarget();
    constructor(id, label, value = "#000000") {
      super();
      this.id = id;
      this.label = label;
      this.value = value;
    }
    render() {
      this.$element = $(`
            <div class="nipah__color">
                <label for="${this.id}">${this.label}</label>
                <input type="color" id="${this.id}" value="${this.value}">
            </div>
        `);
    }
    attachEventHandlers() {
      this.$element.find("input").on("change", (e) => {
        this.value = e.target.value;
        this.event.dispatchEvent(new Event("change"));
      });
    }
    getValue() {
      return this.value;
    }
  };

  // src/UserInterface/Components/DropdownComponent.js
  var DropdownComponent = class extends AbstractComponent {
    event = new EventTarget();
    constructor(id, label, options = []) {
      super();
      this.id = id;
      this.label = label;
      this.options = options;
    }
    render() {
      this.$element = $(`
            <div class="nipah__dropdown">
                <label for="${this.id}">${this.label}</label>
                <select id="${this.id}">
                    ${this.options.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
                </select>
            </div>
        `);
    }
    attachEventHandlers() {
      this.$element.find("select").on("change", (e) => {
        this.event.dispatchEvent(new Event("change"));
      });
    }
    getValue() {
      return this.$element.find("select").val();
    }
  };

  // src/UserInterface/Components/Modals/SettingsModal.js
  var SettingsModal = class extends AbstractModal {
    constructor(eventBus, settingsOpts) {
      super("settings");
      this.eventBus = eventBus;
      this.settingsOpts = settingsOpts;
    }
    init() {
      super.init();
    }
    render() {
      super.render();
      log("Rendering settings modal..");
      const sharedSettings = this.settingsOpts.sharedSettings;
      const settingsMap = this.settingsOpts.settingsMap;
      const $modalBody = this.$modalBody;
      const $panels = $(`<div class="nipah__settings-modal__panels"></div>`);
      this.$panels = $panels;
      const $sidebar = $(`
			<div class="nipah__settings-modal__sidebar">
				<ul></ul>
			</div>
		`);
      this.$sidebar = $sidebar;
      const $sidebarList = $sidebar.find("ul");
      for (const category of sharedSettings) {
        const $category = $(`
				<li class="nipah__settings-modal__category">
					<span>${category.label}</span>
					<ul></ul>
				</li>
			`);
        const $categoryList = $category.find("ul");
        $sidebarList.append($category);
        for (const subCategory of category.children) {
          const categoryId = `${category.label.toLowerCase()}.${subCategory.label.toLowerCase()}`;
          const $subCategory = $(`
					<li data-panel="${categoryId}" class="nipah__settings-modal__sub-category">
						<span>${subCategory.label}</span>
					</li>
				`);
          $categoryList.append($subCategory);
        }
      }
      for (const category of sharedSettings) {
        for (const subCategory of category.children) {
          const categoryId = `${category.label.toLowerCase()}.${subCategory.label.toLowerCase()}`;
          const $subCategoryPanel = $(
            `<div data-panel="${categoryId}" class="nipah__settings-modal__panel" style="display: none"></div>`
          );
          $panels.append($subCategoryPanel);
          for (const group of subCategory.children) {
            const $group = $(`<div class="nipah__settings__group"></div>`);
            $subCategoryPanel.append($group);
            for (const setting of group.children) {
              let settingComponent;
              let settingValue = settingsMap.get(setting.id);
              if (typeof settingValue === "undefined") {
                settingValue = setting.default;
              }
              switch (setting.type) {
                case "checkbox":
                  settingComponent = new CheckboxComponent(setting.id, setting.label, settingValue);
                  break;
                case "color":
                  settingComponent = new ColorComponent(setting.id, setting.label, settingValue);
                  break;
                case "dropdown":
                  settingComponent = new DropdownComponent(
                    setting.id,
                    setting.label,
                    setting.options,
                    settingValue
                  );
                  break;
                default:
                  error2(`No component found for setting type: ${setting.type}`);
                  continue;
              }
              settingComponent.init();
              $group.append(settingComponent.$element);
              settingComponent.event.addEventListener("change", () => {
                const value = settingComponent.getValue();
                this.event.dispatchEvent(
                  new CustomEvent("setting_change", { detail: { id: setting.id, value } })
                );
              });
            }
          }
        }
      }
      $panels.find(".nipah__settings-modal__panel").first().show();
      $modalBody.append($sidebar);
      $modalBody.append($panels);
    }
    getSettingElement(setting) {
    }
    attachEventHandlers() {
      super.attachEventHandlers();
      $(".nipah__settings-modal__sub-category", this.$sidebar).on("click", (evt) => {
        const panelId = $(evt.currentTarget).data("panel");
        $(".nipah__settings-modal__panel", this.$panels).hide();
        $(`[data-panel="${panelId}"]`, this.$panels).show();
      });
    }
  };

  // src/SettingsManager.js
  var SettingsManager = class {
    /*
       - Shared global settings
           = Chat
               = Appearance
                   (Appearance)
                   - Highlight first messages
                   - Highlight Color	
                   - Display lines with alternating background colors
                   - Seperators (dropdown)
                   (General)
                   - Use Ctrl+E to open the Emote Menu
               = Emote Menu
                   (Appearance)
                   - Show a quick navigation bar along the side of the menu
                   - Show the search box
               = Input
                   (Recent Messages)
                   - Allow pressing up and down to recall previously sent chat messages
                   (Tab completion)
                   - Display multiple entries in the tab-completion tooltip
                   - Display a tooltip when using tab-completion
                   - Allow tab-completion of emoji
                   - Allow tab-completion of emotes without typing a colon. (:)
                   - Priortize favorite emotes at the top
               = Tooltips
                   (General)
                   - Display images in tooltips
       - Platform specific settings, because limited UI specific support
       - Provider specific settings
           - 7TV
               - Specify what emotes to load, channel emotes, global emotes, personal emotes
               - Show emote update messages
           - BetterTTV
               - Specify what emotes to load, channel emotes, global emotes
       */
    sharedSettings = [
      {
        label: "Chat",
        children: [
          {
            label: "Appearance",
            children: [
              {
                label: "Appearance",
                children: [
                  {
                    label: "Highlight first messages (not yet implemented)",
                    id: "shared.chat.appearance.highlight",
                    default: false,
                    type: "checkbox"
                  },
                  {
                    label: "Highlight Color (not yet implemented)",
                    id: "shared.chat.appearance.highlight_color",
                    default: "",
                    type: "color"
                  },
                  {
                    label: "Display lines with alternating background colors",
                    id: "shared.chat.appearance.alternating_background",
                    default: false,
                    type: "checkbox"
                  },
                  {
                    label: "Seperators",
                    id: "shared.chat.appearance.seperators",
                    default: "",
                    type: "dropdown",
                    options: [
                      {
                        label: "Disabled",
                        value: "none"
                      },
                      {
                        label: "Basic Line (1px Solid)",
                        value: "basic"
                      },
                      {
                        label: "3D Line (2px Groove)",
                        value: "3d"
                      },
                      {
                        label: "3D Line (2x Groove Inset)",
                        value: "3d-inset"
                      },
                      {
                        label: "Wide Line (2px Solid)",
                        value: "wide"
                      }
                    ]
                  }
                ]
              },
              {
                label: "General",
                children: [
                  {
                    label: "Use Ctrl+E to open the Emote Menu (not yet implemented)",
                    id: "shared.chat.appearance.emote_menu_ctrl_e",
                    default: false,
                    type: "checkbox"
                  },
                  {
                    label: "Use Ctrl+Spacebar to open the Emote Menu (not yet implemented)",
                    id: "shared.chat.appearance.emote_menu_ctrl_spacebar",
                    default: true,
                    type: "checkbox"
                  }
                ]
              }
            ]
          },
          {
            label: "Emote Menu",
            children: [
              {
                label: "Appearance",
                children: [
                  {
                    label: "Show a quick navigation bar along the side of the menu (not yet implemented)",
                    id: "shared.chat.emote_menu.appearance.quick_nav",
                    default: true,
                    type: "checkbox"
                  },
                  {
                    label: "Show the search box (not yet implemented)",
                    id: "shared.chat.emote_menu.appearance.search_box",
                    default: true,
                    type: "checkbox"
                  }
                ]
              }
            ]
          },
          {
            label: "Input",
            children: [
              {
                label: "Recent Messages",
                children: [
                  {
                    label: "Allow pressing up and down to recall previously sent chat messages (not yet implemented)",
                    id: "shared.chat.input.recent_messages.recall",
                    default: true,
                    type: "checkbox"
                  }
                ]
              },
              {
                label: "Tab completion",
                children: [
                  {
                    label: "Display multiple entries in the tab-completion tooltip (not yet implemented)",
                    id: "shared.chat.input.tab_completion.multiple_entries",
                    default: true,
                    type: "checkbox"
                  },
                  {
                    label: "Display a tooltip when using tab-completion (not yet implemented)",
                    id: "shared.chat.input.tab_completion.tooltip",
                    default: true,
                    type: "checkbox"
                  },
                  {
                    label: "Allow tab-completion of emoji (not yet implemented)",
                    id: "shared.chat.input.tab_completion.emoji",
                    default: false,
                    type: "checkbox"
                  },
                  {
                    label: "Allow tab-completion of emotes without typing a colon. (:) (not yet implemented)",
                    id: "shared.chat.input.tab_completion.no_colon",
                    default: false,
                    type: "checkbox"
                  },
                  {
                    label: "Priortize favorite emotes at the top (not yet implemented)",
                    id: "shared.chat.input.tab_completion.favorite",
                    default: true,
                    type: "checkbox"
                  }
                ]
              }
            ]
          },
          {
            label: "Tooltips",
            children: [
              {
                label: "General",
                children: [
                  {
                    label: "Display images in tooltips",
                    id: "shared.chat.tooltips.images",
                    default: true,
                    type: "checkbox"
                  }
                ]
              }
            ]
          }
        ]
      }
    ];
    settingsMap = /* @__PURE__ */ new Map();
    isShowingModal = false;
    modal = null;
    isLoaded = false;
    constructor(eventBus) {
      this.eventBus = eventBus;
    }
    initialize() {
      const { eventBus } = this;
      for (const category of this.sharedSettings) {
        for (const subCategory of category.children) {
          for (const group of subCategory.children) {
            for (const setting of group.children) {
              this.settingsMap.set(setting.id, setting.default);
            }
          }
        }
      }
      this.loadSettings();
      eventBus.subscribe("nipah.ui.settings.toggle_show", this.handleShowModal.bind(this));
    }
    loadSettings() {
      for (const [key, value] of this.settingsMap) {
        const storedValue = localStorage.getItem("nipah.settings." + key);
        if (typeof storedValue !== "undefined" && storedValue !== null) {
          const parsedValue = storedValue === "true" ? true : storedValue === "false" ? false : storedValue;
          this.settingsMap.set(key, parsedValue);
        }
      }
      this.isLoaded = true;
    }
    setSetting(key, value) {
      if (!key || typeof value === "undefined")
        return error2("Invalid setting key or value", key, value);
      this.settingsMap.set(key, value);
      localStorage.setItem("nipah.settings." + key, value);
    }
    getSetting(key) {
      return this.settingsMap.get(key);
    }
    handleShowModal(evt) {
      this.showModal(!this.isShowingModal);
    }
    showModal(bool) {
      if (!this.isLoaded) {
        return error2(
          "Unable to show settings modal because the settings are not loaded yet, please wait for it to load first."
        );
      }
      if (bool === false) {
        this.isShowingModal = false;
        if (this.modal) {
          this.modal.destroy();
          this.modal = null;
        }
      } else {
        this.isShowingModal = true;
        if (this.modal)
          return;
        this.modal = new SettingsModal(this.eventBus, {
          sharedSettings: this.sharedSettings,
          settingsMap: this.settingsMap
        });
        this.modal.init();
        this.modal.event.addEventListener("close", () => {
          this.isShowingModal = false;
          this.modal = null;
        });
        this.modal.event.addEventListener("setting_change", (evt) => {
          const { id, value } = evt.detail;
          const prevValue = this.settingsMap.get(id);
          this.setSetting(id, value);
          this.eventBus.publish("nipah.settings.change." + id, { value, prevValue });
        });
      }
    }
  };

  // src/app.js
  var window2 = unsafeWindow || window2;
  var NipahClient = class {
    ENV_VARS = {
      VERSION: "1.0.0",
      PLATFORM: PLATFORM_ENUM.NULL,
      // RESOURCE_ROOT: 'http://localhost:3000',
      // RESOURCE_ROOT: 'https://github.com/Xzensi/Nipah-Chat/raw/master',
      RESOURCE_ROOT: "https://cdn.jsdelivr.net/gh/Xzensi/Nipah-Chat@master",
      DEBUG: false
    };
    async initialize() {
      info(`Initializing Nipah client ${this.VERSION}..`);
      const { ENV_VARS } = this;
      if (window2.app_name === "Kick") {
        this.ENV_VARS.PLATFORM = PLATFORM_ENUM.KICK;
        info("Platform detected: Kick");
      } else {
        return error2("Unsupported platform", window2.app_name);
      }
      const eventBus = new Publisher();
      const settingsManager = new SettingsManager(eventBus);
      settingsManager.initialize();
      settingsManager.loadSettings();
      const channelData = await this.loadChannelData();
      if (!channelData)
        return error2("Failed to load channel data");
      const emotesManager = new EmotesManager(eventBus, channelData.kick_channel_id);
      let userInterface;
      if (ENV_VARS.PLATFORM === PLATFORM_ENUM.KICK) {
        userInterface = new KickUserInterface({ ENV_VARS, eventBus, settingsManager, emotesManager });
      } else {
        return error2("Platform has no user interface imlemented..", ENV_VARS.PLATFORM);
      }
      this.loadStyles().then(() => {
        userInterface.loadInterface();
      }).catch((response) => error2("Failed to load styles.", response));
      emotesManager.registerProvider(KickProvider);
      emotesManager.registerProvider(SevenTVProvider);
      emotesManager.loadProviderEmotes(channelData);
    }
    loadStyles() {
      return new Promise((resolve, reject) => {
        info("Injecting styles..");
        if (this.DEBUG) {
          GM_xmlhttpRequest({
            method: "GET",
            url: this.RESOURCE_ROOT + "/dist/kick.css",
            onerror: reject,
            onload: function(response) {
              GM_addStyle(response.responseText);
              resolve();
            }
          });
        } else {
          let style;
          switch (this.ENV_VARS.PLATFORM) {
            case PLATFORM_ENUM.KICK:
              style = "KICK_CSS";
              break;
            default:
              return reject("Unsupported platform");
          }
          const stylesheet = GM_getResourceText(style);
          if (!stylesheet)
            return reject("Failed to load stylesheet");
          if (stylesheet.substring(0, 4) === "http") {
            reject("Invalid stylesheet resource.");
          }
          GM_addStyle(stylesheet);
          resolve();
        }
      });
    }
    async loadChannelData() {
      const channelName = window2.location.pathname.substring(1).split("/")[0];
      if (!channelName)
        throw new Error("Failed to extract channel name from URL");
      const channelRequestData = await fetchJSON(`https://kick.com/api/v2/channels/${channelName}`);
      if (!channelRequestData) {
        throw new Error("Failed to fetch channel data");
      }
      if (!channelRequestData.id || !channelRequestData.user_id) {
        throw new Error("Invalid channel data");
      }
      const channelData = {
        kick_user_id: channelRequestData.user_id,
        kick_channel_id: channelRequestData.id,
        kick_channel_name: channelName
      };
      this.channelData = channelData;
      return channelData;
    }
    initKeyboardShortcuts() {
    }
  };
  info("Running Nipah Client script.");
  log("Waiting for message input field..");
  var awaitLoadInterval = setInterval(() => {
    if (window2.app_name !== "Kick" || !document.getElementById("message-input")) {
      return;
    }
    log("Message input field found.");
    clearInterval(awaitLoadInterval);
    setTimeout(() => {
      const nipahClient = new NipahClient();
      nipahClient.initialize();
    }, 1500);
  }, 100);
})();
