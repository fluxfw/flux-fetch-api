import { METHOD_GET } from "../../../Adapter/Method/METHOD.mjs";
import { ASSERT_TYPE_CSS, ASSERT_TYPE_JSON } from "../../../Adapter/AssertType/ASSERT_TYPE.mjs";
import { CONTENT_TYPE_CSS, CONTENT_TYPE_JSON } from "../../../Adapter/ContentType/CONTENT_TYPE.mjs";
import { HEADER_ACCEPT, HEADER_CONTENT_TYPE } from "../../../Adapter/Header/HEADER.mjs";

/** @typedef {import("../../../Adapter/Fetch/authenticate.mjs").authenticate} _authenticate */
/** @typedef {import("../../../Adapter/Fetch/Fetch.mjs").Fetch} Fetch */
/** @typedef {import("../../../Adapter/Fetch/showError.mjs").showError} showError */

export class FetchCommand {
    /**
     * @type {_authenticate | null}
     */
    #authenticate;
    /**
     * @type {showError | null}
     */
    #show_error;

    /**
     * @param {_authenticate | null} authenticate
     * @param {showError | null} show_error
     * @returns {FetchCommand}
     */
    static new(authenticate = null, show_error = null) {
        return new this(
            authenticate,
            show_error
        );
    }

    /**
     * @param {_authenticate | null} authenticate
     * @param {showError | null} show_error
     * @private
     */
    constructor(authenticate, show_error) {
        this.#authenticate = authenticate;
        this.#show_error = show_error;
    }

    /**
     * @param {Fetch} _fetch
     * @returns {Promise<*>}
     */
    async fetch(_fetch) {
        const query_params = _fetch.query_params ?? null;

        const method = _fetch.method ?? METHOD_GET;
        const data = _fetch.data ?? null;
        const abort_signal = _fetch.abort_signal ?? null;

        const error_ui = !_fetch.no_ui && !_fetch.no_error_ui && this.#show_error !== null;
        const authenticate = !_fetch.no_ui && !_fetch.no_authenticate && this.#authenticate !== null;

        const assert_type = _fetch.assert_type ?? ASSERT_TYPE_JSON;

        try {
            const url = new URL(_fetch.url.startsWith("/") ? `${location.origin}${_fetch.url}` : _fetch.url);

            if (query_params !== null) {
                for (const [
                    key,
                    value
                ] of Object.entries(_fetch.query_params)) {
                    if ((value ?? null) === null) {
                        continue;
                    }
                    url.searchParams.append(key, Array.isArray(value) ? value.join(",") : value);
                }
            }

            const headers = new Headers();

            let accept;
            switch (assert_type) {
                case ASSERT_TYPE_CSS:
                    accept = CONTENT_TYPE_CSS;
                    break;

                case ASSERT_TYPE_JSON:
                    accept = CONTENT_TYPE_JSON;
                    break;

                default:
                    throw new Error(`Unknown assert type ${assert_type}`);
            }
            headers.set(HEADER_ACCEPT, accept);

            let body;
            if (data !== null) {
                headers.set(HEADER_CONTENT_TYPE, CONTENT_TYPE_JSON);
                body = JSON.stringify(data);
            } else {
                body = null;
            }

            const response = await fetch(url, {
                method,
                body,
                headers,
                signal: abort_signal
            });

            if (authenticate && response.status === 401 && await this.#authenticate()) {
                return this.fetch(
                    _fetch
                );
            }

            if (!response.ok) {
                console.error("Fetch non-ok response (", response, ")");

                if (error_ui && await this.#show_error(
                    response
                )) {
                    return this.fetch(
                        _fetch
                    );
                }

                return Promise.reject(response);
            }

            const content_type = response.headers.get(HEADER_CONTENT_TYPE) ?? "";
            switch (assert_type) {
                case ASSERT_TYPE_CSS:
                    if (!content_type.includes(CONTENT_TYPE_CSS)) {
                        throw new Error(`Response header ${HEADER_CONTENT_TYPE} need to be ${CONTENT_TYPE_CSS}, got ${content_type}`);
                    }

                    return response.text();

                case ASSERT_TYPE_JSON:
                    if (!content_type.includes(CONTENT_TYPE_JSON)) {
                        throw new Error(`Response header ${HEADER_CONTENT_TYPE} need to be ${CONTENT_TYPE_JSON}, got ${content_type}`);
                    }

                    return response.json();

                default:
                    throw new Error(`Unknown assert type ${assert_type}`);
            }
        } catch (error) {
            console.error("Fetch error (", error, ")");

            if (error_ui && await this.#show_error(
                error
            )) {
                return this.fetch(
                    _fetch
                );
            }

            throw error;
        }
    }
}
