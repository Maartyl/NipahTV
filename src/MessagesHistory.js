export class MessagesHistory {
	constructor() {
		this.messages = []
		this.cursorIndex = -1
		this.maxMessages = 50
	}

	addMessage(message) {
		if (message === '') return
		if (this.messages[0] === message) return

		this.messages.unshift(message)
		if (this.messages.length > this.maxMessages) {
			this.messages.pop()
		}
	}

	canMoveCursor(direction) {
		// Direction is either 1 or -1
		if (direction === 1) {
			return this.cursorIndex < this.messages.length - 1
		} else if (direction === -1) {
			return this.cursorIndex > 0
		}
	}

	moveCursor(direction) {
		this.cursorIndex += direction
		if (this.cursorIndex < 0) {
			this.cursorIndex = 0
		} else if (this.cursorIndex >= this.messages.length) {
			this.cursorIndex = this.messages.length - 1
		}
	}

	moveCursorUp() {
		if (this.cursorIndex < this.messages.length - 1) {
			this.cursorIndex++
		}
	}

	moveCursorDown() {
		if (this.cursorIndex > 0) {
			this.cursorIndex--
		}
	}

	isCursorAtStart() {
		return this.cursorIndex === -1
	}

	getMessage() {
		return this.messages[this.cursorIndex]
	}

	resetCursor() {
		this.cursorIndex = -1
	}
}
