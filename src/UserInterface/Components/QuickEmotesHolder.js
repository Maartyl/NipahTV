import { log, info, error, assertArgDefined } from '../../utils'
import { AbstractComponent } from './AbstractComponent'

export class QuickEmotesHolder extends AbstractComponent {
	// The sorting list shadow reflects the order of emotes in this.$element
	sortingList = []

	constructor({ eventBus, emotesManager }) {
		super()

		this.eventBus = eventBus
		this.emotesManager = emotesManager
	}

	render() {
		this.$element = $(`<div class="nipah_client_quick_emotes_holder"></div>`)

		const $oldEmotesHolder = $('#chatroom-footer .quick-emotes-holder')
		$oldEmotesHolder.after(this.$element)
		$oldEmotesHolder.remove()
	}

	attachEventHandlers() {
		this.$element.on('click', 'img', evt => {
			const emoteId = evt.target.getAttribute('data-emote-id')
			if (!emoteId) return error('Invalid emote id')
			this.handleEmoteClick(emoteId, !!evt.ctrlKey)
		})

		// Wait for all emotes to load before we populate the quick emotes holder
		this.eventBus.subscribe('nipah.providers.loaded', this.loadEmotes.bind(this), true)

		// Update the quick emotes holder when emote history changes
		this.eventBus.subscribe('nipah.datastore.emotes.history.changed', this.handleEmotesHistoryChanged.bind(this))
	}

	loadEmotes() {
		const { emotesManager } = this
		const emoteHistory = emotesManager.getEmoteHistory()

		if (emoteHistory.size) {
			for (const [emoteId, history] of emoteHistory) {
				this.updateEmoteHistory(emoteId)
			}
		}
	}

	handleEmoteClick(emoteId, sendImmediately = false) {
		assertArgDefined(emoteId)

		const { emotesManager } = this
		const emote = emotesManager.getEmote(emoteId)
		if (!emote) return error('Invalid emote')

		this.eventBus.publish('nipah.ui.emote.click', { emoteId, sendImmediately })
	}

	/**
	 * When an emote is used, it's history count is updated and the emote is moved to the correct position
	 *  in the quick emote holder according to the updated history count.
	 */
	handleEmotesHistoryChanged({ emoteId }) {
		if (!emoteId) return error('Invalid emote id')

		this.updateEmoteHistory(emoteId)
	}

	updateEmoteHistory(emoteId) {
		const { emotesManager } = this
		const emote = emotesManager.getEmote(emoteId)
		if (!emote) return error('Invalid emote')

		const emoteInSortingListIndex = this.sortingList.findIndex(entry => entry.id === emoteId)

		if (emoteInSortingListIndex !== -1) {
			const emoteToSort = this.sortingList[emoteInSortingListIndex]
			emoteToSort.$emote.remove()

			this.sortingList.splice(emoteInSortingListIndex, 1)

			const insertIndex = this.getSortedEmoteIndex(emoteId)
			if (insertIndex !== -1) {
				this.sortingList.splice(insertIndex, 0, emoteToSort)
				this.$element.children().eq(insertIndex).before(emoteToSort.$emote)
			} else {
				this.sortingList.push(emoteToSort)
				this.$element.append(emoteToSort.$emote)
			}
		} else {
			const $emotePartial = $(emotesManager.getRenderableEmote(emoteId))
			const insertIndex = this.getSortedEmoteIndex(emoteId)

			if (insertIndex !== -1) {
				this.sortingList.splice(insertIndex, 0, { id: emoteId, $emote: $emotePartial })
				this.$element.children().eq(insertIndex).before($emotePartial)
			} else {
				this.sortingList.push({ id: emoteId, $emote: $emotePartial })
				this.$element.append($emotePartial)
			}
		}
	}

	getSortedEmoteIndex(emoteId) {
		// Find the correct position in sortingList to insert the emote
		//  according to the emote history count.
		const { emotesManager } = this
		const emoteHistoryCount = emotesManager.getEmoteHistoryCount(emoteId)
		return this.sortingList.findIndex(entry => {
			return emotesManager.getEmoteHistoryCount(entry.id) < emoteHistoryCount
		})
	}
}