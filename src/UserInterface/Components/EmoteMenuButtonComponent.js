import { cleanupHTML } from '../../utils'
import { AbstractComponent } from './AbstractComponent'

export class EmoteMenuButtonComponent extends AbstractComponent {
	constructor({ ENV_VARS, eventBus, settingsManager }) {
		super()

		this.ENV_VARS = ENV_VARS
		this.eventBus = eventBus
		this.settingsManager = settingsManager
	}

	render() {
		// Delete any existing footer logo button, in case cached page got loaded somehow
		$('.nipah_client_footer').remove()

		const basePath = this.ENV_VARS.RESOURCE_ROOT + '/assets/img/btn'
		const filename = this.getFile()

		this.$element = $(
			cleanupHTML(`
				<div class="nipah_client_footer">
					<img class="footer_logo_btn ${filename.toLowerCase()}" src="${basePath}/${filename}.png" draggable="false" alt="Nipah">
				</div>
			`)
		)
		this.$footerLogoBtn = $('.footer_logo_btn', this.$element)
		$('#chatroom-footer .send-row').prepend(this.$element)
	}

	attachEventHandlers() {
		this.eventBus.subscribe('ntv.settings.change.shared.chat.emote_menu.appearance.button_style', () => {
			const filename = this.getFile()
			this.$footerLogoBtn.attr('src', `${this.ENV_VARS.RESOURCE_ROOT}/assets/img/btn/${filename}.png`)
			this.$footerLogoBtn.removeClass()
			this.$footerLogoBtn.addClass(`footer_logo_btn ${filename.toLowerCase()}`)
		})

		$('.footer_logo_btn', this.$element).click(() => {
			this.eventBus.publish('ntv.ui.footer.click')
		})
	}

	getFile() {
		const buttonStyle = this.settingsManager.getSetting('shared.chat.emote_menu.appearance.button_style')
		let file = 'Nipah'

		switch (buttonStyle) {
			case 'nipahtv':
				file = 'NipahTV'
				break
			case 'ntv':
				file = 'NTV'
				break
			case 'ntv_3d':
				file = 'NTV_3D'
				break
			case 'ntv_3d_rgb':
				file = 'NTV_3D_RGB'
				break
			case 'ntv_3d_shadow':
				file = 'NTV_3D_RGB_Shadow'
				break
			case 'ntv_3d_shadow_beveled':
				file = 'NTV_3D_RGB_Shadow_bevel'
				break
		}

		return file
	}

	destroy() {
		this.$element.remove()
	}
}
