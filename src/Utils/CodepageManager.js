import iconv from 'Vendors/iconv-lite.js';

/*
 * RAGIDLE (15/10/2026): o UTF-8 pelo TextDecoder nativo, e nao pelo iconv-lite.
 *
 * Todo `readString` dos pacotes passa por aqui (BinaryReader.getString), e o
 * iconv-lite decodifica UTF-8 em JS puro (o Buffer e o StringDecoder de
 * polyfill): medido 377 us contra 49 us do TextDecoder num JSON de 32 KB.
 *
 * A semantica fica a MESMA, e o oraculo que prova e
 * `tests/core/utf8NativoIgualAoIconv.test.js` (milhares de entradas: validas,
 * invalidas, truncadas, com BOM, com U+FFFD legitimo, CP949):
 *  - BOM: o iconv tira o BOM do inicio (`stripBOM`), e o TextDecoder com
 *    `ignoreBOM: false` (o padrao) tambem;
 *  - byte invalido: os dois trocam por U+FFFD, e QUALQUER U+FFFD manda para o
 *    charset antigo em `smartDecode` - entao, mesmo onde a CONTAGEM de U+FFFD
 *    pudesse diferir, a saida de `smartDecode` nao muda.
 *
 * Sem TextDecoder no ambiente, ou se ele lancar, volta ao iconv de sempre:
 * este caminho decodifica o LOGIN (D-993), e nada aqui pode impedir a entrada.
 */
let _utf8Nativo;

function decodificadorUtf8Nativo() {
	if (_utf8Nativo === undefined) {
		_utf8Nativo = null;
		try {
			if (typeof TextDecoder !== 'undefined') {
				_utf8Nativo = new TextDecoder('utf-8');
			}
		} catch (_err) {
			_utf8Nativo = null;
		}
	}
	return _utf8Nativo;
}

function decodificarUtf8(bytes) {
	const nativo = decodificadorUtf8Nativo();
	if (nativo !== null) {
		try {
			return nativo.decode(bytes);
		} catch (_err) {
			// cai no iconv abaixo
		}
	}
	return iconv.decode(bytes, 'utf-8');
}

/**
 * Smart decode helper.
 *
 * Tries to decode the given byte array as UTF-8 first (default server-side charpage).
 * If the result contains the Unicode replacement character (U+FFFD, '�'),
 * it means some byte sequences were invalid for UTF-8 (i.e. raw bytes that
 * do not form a valid character in that encoding).
 *
 * In that case, we fallback to the provided legacy user charpage encoding (e.g. windows-1252, windows-949).
 *
 * @param {Uint8Array|Buffer} bytes - Raw byte data to decode.
 * @param {string} fallback - Fallback encoding to use if UTF-8 decoding is invalid.
 * @returns {string} Decoded string.
 */
function smartDecode(bytes, fallback) {
	const utf8 = decodificarUtf8(bytes);
	if (!/�/.test(utf8)) {
		return utf8;
	}
	return iconv.decode(bytes, fallback);
}

/**
 * Exports
 */
const CodepageManager = {
	/*
	 * @param {string} charset - Charset to use for decoding.
	 */
	setCharset: function setCharset(charset) {
		const supported = ['windows-1252', 'windows-949', 'windows-1251', 'windows-932']; // GRF Editor default charsets
		if (supported.indexOf(charset) === -1 && !this.warned) {
			console.warn(
				'%c[Warning] You are using a ' +
					charset +
					' charset. \nIf you have some charset ' +
					'problem set ROConfig.servers[<index>].disableKorean to true or use a proper charset !',
				'font-weight:bold; color:red; font-size:14px'
			);
			this.warned = true;
		}

		if (!iconv.encodingExists(charset)) {
			console.error(`[TextEncoding.setCharset] Invalid charset: "${charset}".`);
			return;
		}

		this.userCharset = charset;
	},
	/*
	 * @param {string} str - String to encode.
	 * @param {string} charset? - Charset to use for encoding.
	 * @returns {Uint8Array} Encoded string.
	 */
	encode: function encode(str, charset = null) {
		if (typeof str !== 'string') {
			console.error(`[TextEncoding.encode] Invalid input type: expected "string", got "${typeof str}".`, str);
			return new Uint8Array(0);
		} else if (charset && !iconv.encodingExists(charset)) {
			console.error(`[TextEncoding.decode] Invalid charset: "${charset}".`, str);
			return new Uint8Array(0);
		}

		return iconv.encode(str, charset || this.userCharset);
	},
	/*
	 * @param {Uint8Array} data - Raw byte data to decode.
	 * @param {string} charset? - Charset to use for decoding.
	 * @returns {string} Decoded string.
	 */
	decode: function decode(data, charset = null) {
		if (!(data instanceof Uint8Array)) {
			console.error(
				`[TextEncoding.decode] Invalid input type: expected "Uint8Array", got "${typeof data}".`,
				data
			);
			return '';
		} else if (charset && (typeof charset !== 'string' || !iconv.encodingExists(charset))) {
			console.error(`[TextEncoding.decode] Invalid charset: "${charset}".`, data);
			return '';
		}
		if (charset === 'utf-8') {
			// triggered on server string decoding defined on BinaryReader
			return smartDecode(data, this.userCharset);
		}
		return iconv.decode(data, charset || this.userCharset);
	},

	decodeString: function decodeString(str) {
		if (!str) {
			return '';
		}

		const count = str.length;
		const data = new Uint8Array(count);

		for (let i = 0; i < count; ++i) {
			data[i] = str.charCodeAt(i);
		}
		return iconv.decode(data, this.userCharset);
	},

	detectEncodingByLangtype: detectEncodingByLangtype
};

function detectEncodingByLangtype(langType, disableKorean) {
	let result;
	/// Special thanks to curiosity, siriuswhite and ai4rei. See:
	/// - http://hercules.ws/wiki/Clientinfo.xml
	/// - http://forum.robrowser.com/index.php?topic=32231
	/// - http://siriuswhite.de/rodoc/codepage.html
	switch (langType) {
		case 0x00: // SERVICETYPE_KOREA
			result = 'windows-949';
			break;

		case 0x01: // SERVICETYPE_AMERICA
			result = 'windows-1252';
			break;

		case 0x02: // SERVICETYPE_JAPAN
			result = 'shift-jis';
			break;

		case 0x03: // SERVICETYPE_CHINA
			result = 'gbk';
			break;

		case 0x04: // SERVICETYPE_TAIWAN
			result = 'big5';
			break;

		case 0x05: // SERVICETYPE_THAI
			result = 'windows-874';
			break;

		case 0x06: // SERVICETYPE_INDONESIA
		case 0x07: // SERVICETYPE_PHILIPPINE
		case 0x08: // SERVICETYPE_MALAYSIA
		case 0x09: // SERVICETYPE_SINGAPORE
		case 0x0a: // SERVICETYPE_GERMANY
		case 0x0b: // SERVICETYPE_INDIA
		case 0x0c: // SERVICETYPE_BRAZIL
		case 0x0d: // SERVICETYPE_AUSTRALIA
			result = 'windows-1252';
			break;
		case 0x0e: // SERVICETYPE_RUSSIA
			result = 'windows-1251';
			break;

		case 0x0f: // SERVICETYPE_VIETNAM
			result = 'windows-1258';
			break;

		// Not supported by the encoder/decoder, default to windows-1252
		//case 0x11: // SERVICETYPE_CHILE
		//	result = 'windows-1145';
		//	break;

		case 0x12: // SERVICETYPE_FRANCE
			result = 'windows-1252';
			break;

		case 0x13: // SERVICETYPE_UAE
			result = 'windows-1256';
			break;

		/////////////////////////////////////////////////////
		// CUSTOM TYPES                                    //
		// Only use them if you know what you are doing ;) //
		/////////////////////////////////////////////////////
		case 0xa0: // 160 - Central European
			result = 'windows-1250';
			break;

		case 0xa1: // 161 - Greek
			result = 'windows-1253';
			break;

		case 0xa2: // 162 - Tukish
			result = 'windows-1254';
			break;

		case 0xa3: // 163 - Hebrew
			result = 'windows-1255';
			break;

		case 0xa4: // 164 - Estonian, Latvian, Lithuaninan
			result = 'windows-1257';
			break;

		/////////////////////////////////////////////////////
		// Custom unicode types                            //
		// Only use them if you know what you are doing ;) //
		/////////////////////////////////////////////////////
		case 0xf0: // 240 - UTF-8
			result = 'utf-8';
			break;
		case 0xf1: // 241 - UTF-16LE
			result = 'utf-16le';
			break;
		case 0xf2: // 242 - UTF-16BE
			result = 'utf-16be';
			break;

		default: // Latin1
			result = 'windows-1252';
			break;
	}

	if (disableKorean) {
		result = 'windows-1252';
	}

	return result;
}

CodepageManager.setCharset('windows-1252');

export default CodepageManager;
