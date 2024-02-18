import { AbstractProvider } from './AbstractProvider'
import { PLATFORM_ENUM } from '../constants'
import { log, info, error, fetchJSON } from '../utils'

export class SevenTVProvider extends AbstractProvider {
	id = PLATFORM_ENUM.SEVENTV
	status = 'unloaded'

	constructor(datastore) {
		super(datastore)
	}

	async fetchEmotes({ kick_user_id }) {
		info('Fetching emote data from SevenTV..')
		if (!kick_user_id) return error('Missing kick channel id for SevenTV provider.')

		// TODO Global 7tv emotes are still missing, seems to be hardcoded?
		const data = await fetchJSON(`https://7tv.io/v3/users/KICK/${kick_user_id}`)
		if (!data.emote_set || !data.emote_set.emotes.length) {
			log('No emotes found on SevenTV provider')
			this.status = 'no_emotes_found'
			return []
		}

		// const test = new Set()
		const emotesMapped = data.emote_set.emotes.map(emote => {
			const file = emote.data.host.files[0]
			// test.add(file.width)
			let size
			switch (true) {
				case file.width > 74:
					size = 4
					break
				case file.width > 53:
					size = 3
					break
				case file.width > 32:
					size = 2
					break
				default:
					size = 1
			}
			return {
				id: '' + emote.id,
				name: emote.name,
				provider: PLATFORM_ENUM.SEVENTV,
				width: file.width,
				size
			}
		})
		// log('SIZES:', Array.from(test).sort())

		log(`Fetched 1 emote set from SevenTV.`)
		this.status = 'loaded'

		return [
			{
				provider: this.id,
				order_index: 2,
				name: data.emote_set.name,
				emotes: emotesMapped,
				icon: data.emote_set?.user?.avatar_url || 'https://7tv.app/favicon.ico',
				id: '' + data.emote_set.id
			}
		]
	}

	getRenderableEmote(emote) {
		const srcset = `https://cdn.7tv.app/emote/${emote.id}/1x.avif 1x, https://cdn.7tv.app/emote/${emote.id}/2x.avif 2x, https://cdn.7tv.app/emote/${emote.id}/3x.avif 3x, https://cdn.7tv.app/emote/${emote.id}/4x.avif 4x`

		return `
			<img class="nipah_emote" tabindex="0" size="${emote.size}" data-emote-id="${emote.id}" alt="${emote.name}" srcset="${srcset}" loading="lazy" decoding="async" draggable="false">
		`
	}

	getEmbeddableEmote(emote) {
		return emote.name
	}

	getEmoteSrc(emote) {
		return `https://cdn.7tv.app/emote/${emote.id}/4x.avif`
	}
}