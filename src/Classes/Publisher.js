import { log, logEvent, error, assertArgument, assertArgDefined, fetchJSON, assertArray } from '../utils'
import { DTO } from './DTO'

export class Publisher {
	listeners = new Map()
	onceListeners = new Map()
	firedEvents = new Map()

	subscribe(event, callback, triggerOnExistingEvent = false, once = false) {
		assertArgument(event, 'string')
		assertArgument(callback, 'function')

		if (once) {
			if (once && triggerOnExistingEvent && this.firedEvents.has(event)) {
				callback(this.firedEvents.get(event).data)
				return
			}
			if (!this.onceListeners.has(event)) {
				this.onceListeners.set(event, [])
			}

			this.onceListeners.get(event).push(callback)
		} else {
			if (!this.listeners.has(event)) {
				this.listeners.set(event, [])
			}

			this.listeners.get(event).push(callback)

			if (triggerOnExistingEvent && this.firedEvents.has(event)) {
				callback(this.firedEvents.get(event).data)
			}
		}
	}

	// Fires callback immediately and only when all passed events have been fired
	subscribeAllOnce(events, callback) {
		assertArray(events, 'array')
		assertArgument(callback, 'function')

		const eventsFired = []
		for (const event of events) {
			if (this.firedEvents.has(event)) {
				eventsFired.push(event)
			}
		}

		if (eventsFired.length === events.length) {
			const data = events.map(event => this.firedEvents.get(event).data)
			callback(data)
			return
		}

		const eventListener = data => {
			eventsFired.push(null)

			if (eventsFired.length === events.length) {
				const firedEventsData = events.map(event => this.firedEvents.get(event).data)
				callback(firedEventsData)
			}
		}

		// Skip events we already got in eventsFired
		const remainingEvents = events.filter(event => !eventsFired.includes(event))
		for (const event of remainingEvents) {
			this.subscribe(event, eventListener, true, true)
		}
	}

	unsubscribe(event, callback) {
		assertArgument(event, 'string')
		assertArgument(callback, 'function')

		if (!this.listeners.has(event)) {
			return
		}

		const listeners = this.listeners.get(event)
		const index = listeners.indexOf(callback)
		if (index === -1) {
			return
		}

		listeners.splice(index, 1)
	}

	publish(topic, data) {
		if (!topic) return error('Invalid event topic, discarding event..')
		const dto = new DTO(topic, data)

		this.firedEvents.set(dto.topic, dto)
		logEvent(dto.topic)

		if (this.onceListeners.has(dto.topic)) {
			const listeners = this.onceListeners.get(dto.topic)

			for (let i = 0; i < listeners.length; i++) {
				const listener = listeners[i]
				listener(dto.data)

				listeners.splice(i, 1)
				i--
			}
		}

		if (this.listeners.has(dto.topic)) {
			const listeners = this.listeners.get(dto.topic)
			for (const listener of listeners) {
				listener(dto.data)
			}
		}
	}

	destroy() {
		this.listeners.clear()
		this.firedEvents.clear()
	}
}
