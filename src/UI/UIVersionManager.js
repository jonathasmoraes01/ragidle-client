/**
 * UIVersionManager.js
 *
 * Manage Component
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Configs from 'Core/Configs.js';
import PacketVerManager from 'Network/PacketVerManager.js';

const _UIAliases = {};
class UIVersionManager {
	static getUIAlias(name) {
		return name in _UIAliases ? _UIAliases[name] : false;
	}

	static selectUIVersion(publicName, versionInfo) {
		let SelectedUI = versionInfo.default;
		let _maxDate = 0;

		function getUIbyGameMode(gameMode) {
			if (typeof gameMode === 'object' && Object.keys(gameMode).length > 0) {
				for (const [keydate, UI] of Object.entries(gameMode)) {
					const dateNum = parseInt(keydate);
					if (PacketVerManager.value >= dateNum && dateNum > _maxDate) {
						SelectedUI = UI;
						_maxDate = dateNum;
					}
				}
			}
		}

		// Rag Idle: OVERRIDE por config (uiVersions). O seletor decide so pelo
		// packetver, mas a arte da versao nova pode NAO existir no GRF em uso:
		// o ROLatam daqui nao tem os bitmaps da WinLoginV2 (bt_start_normal,
		// bg_login.tga...), e a tela vinha invisivel com so o hover aparecendo.
		// 'default' forca a versao classica; um numero escolhe a chave exata.
		const _override = (Configs.get('uiVersions') || {})[publicName];
		if (_override === 'default') {
			_UIAliases[publicName] = SelectedUI.name;
			console.log('[UIVersion] ' + publicName + ' (config): ', SelectedUI.name);
			return SelectedUI;
		}
		if (_override && versionInfo.common && versionInfo.common[_override]) {
			SelectedUI = versionInfo.common[_override];
			_UIAliases[publicName] = SelectedUI.name;
			console.log('[UIVersion] ' + publicName + ' (config): ', SelectedUI.name);
			return SelectedUI;
		}

		// Common UI
		getUIbyGameMode(versionInfo.common);

		if (Configs.get('renewal')) {
			// Renewal only UI
			getUIbyGameMode(versionInfo.re);
		} else {
			// Classic only UI
			getUIbyGameMode(versionInfo.prere);
		}

		// Store selected UI name
		_UIAliases[publicName] = SelectedUI.name;
		console.log('%c[UIVersion] ' + publicName + ': ', 'color:#007000', SelectedUI.name);
		return SelectedUI;
	}

	static getUIController(publicName, versionInfo) {
		let _selectedUI;

		const UIController = {};

		UIController.selectUIVersion = function () {
			_selectedUI = UIVersionManager.selectUIVersion(publicName, versionInfo);
		};

		UIController.selectUIVersionWithJob = function (job) {
			_selectedUI = versionInfo.job[job] || versionInfo.job.default;
			_UIAliases[publicName] = _selectedUI.name;
			console.log('[UIVersion] ' + publicName + ': ', _selectedUI.name);
		};

		UIController.selectSpecificUIVersion = function (version) {
			_selectedUI = versionInfo.common[version] || versionInfo.default;
			_UIAliases[publicName] = _selectedUI.name;
			console.log('[UIVersion] ' + publicName + ': ', _selectedUI.name);
		};

		UIController.getUI = function () {
			return _selectedUI;
		};

		return UIController;
	}

	/// DEPRECATED
	/// WILL BE REMOVED AFTER REFACTORING
	static getEquipmentVersion() {
		if (Configs.get('clientVersionMode') === 'PacketVer') {
			if (PacketVerManager.value >= 20090601) {
				return 1;
			} else {
				return 0;
			}
		}
		if (Configs.get('clientVersionMode') === 'PreRenewal') {
			return 0;
		}
		return 1;
	}
	static getWinStatsVersion() {
		if (Configs.get('clientVersionMode') === 'PacketVer') {
			if (PacketVerManager.value >= 20090601) {
				return 1;
			} else {
				return 0;
			}
		}
		if (Configs.get('clientVersionMode') === 'PreRenewal') {
			return 0;
		}
		return 1;
	}
	static getInventoryVersion() {
		if (Configs.get('clientVersionMode') === 'PacketVer') {
			if (PacketVerManager.value >= 20090601) {
				return 1;
			} else {
				return 0;
			}
		}
		if (Configs.get('clientVersionMode') === 'PreRenewal') {
			return 0;
		}
		return 1;
	}
}
export default UIVersionManager;
