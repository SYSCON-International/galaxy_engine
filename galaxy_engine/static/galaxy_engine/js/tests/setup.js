import { beforeEach } from "vitest";

// jsdom implements the ElementInternals *shape* (attachInternals exists, ARIA reflection properties exist)
// but not the form-association methods (setFormValue/setValidity/checkValidity/reportValidity) - see
// https://github.com/jsdom/jsdom/issues/3126. GalaxyInputBase (and everything built on it, including the
// select components under test) calls these on every value change, so without a polyfill nearly every test
// would throw. This tracks just enough state for assertions ("was setFormValue called with X",
// "is the field currently marid invalid") without attempting to model full native form participation.
if (typeof window.ElementInternals === "function" && !window.ElementInternals.prototype.setFormValue) {
    // Object.assign would evaluate the getters below once against the object literal (this === the
    // literal, which has no _validity_flags etc.) and copy the resulting static values as plain data
    // properties - losing per-instance accessor semantics entirely. Object.defineProperties keeps them live.
    Object.defineProperties(window.ElementInternals.prototype, {
        setFormValue: {
            configurable: true,
            value(value, state) {
                this._form_value = value;
                this._form_state = state === undefined ? value : state;
            },
        },
        setValidity: {
            configurable: true,
            value(flags, message, anchor) {
                this._validity_flags = flags || {};
                this._validation_message = Object.keys(this._validity_flags).length > 0 ? (message || "") : "";
                this._validation_anchor = anchor || null;
            },
        },
        checkValidity: {
            configurable: true,
            value() {
                return Object.keys(this._validity_flags || {}).length === 0;
            },
        },
        reportValidity: {
            configurable: true,
            value() {
                return this.checkValidity();
            },
        },
        validity: {
            configurable: true,
            get() {
                return this._validity_flags || {};
            },
        },
        validationMessage: {
            configurable: true,
            get() {
                return this._validation_message || "";
            },
        },
        willValidate: {
            configurable: true,
            get() {
                return true;
            },
        },
    });
}

// Real browsers default a newly-attached shadow root's adoptedStyleSheets to [] (an empty, but present and
// pushable, array). jsdom leaves it undefined until something assigns a full array to it - see
// https://github.com/jsdom/jsdom/issues/2413. GalaxyHTMLComponentBase#add_shadow_css (and GalaxyLoader's own
// custom_style setter) call .push() on it directly, matching real-browser behavior, so without this they'd
// throw in every test that touches either.
let adopted_stylesheets_polyfilled = false;

if (typeof window.Element === "function" && !adopted_stylesheets_polyfilled) {
    let original_attach_shadow = window.Element.prototype.attachShadow;

    window.Element.prototype.attachShadow = function (...args) {
        let shadow_root = original_attach_shadow.apply(this, args);

        if (!Array.isArray(shadow_root.adoptedStyleSheets)) {
            shadow_root.adoptedStyleSheets = [];
        }

        return shadow_root;
    };

    adopted_stylesheets_polyfilled = true;
}

// Components read window.galaxy_engine.GALAXY_COMPONENT_TAG_NAMES (to find other open selects to close) and
// window.galaxy_state_manager.data (to mirror a field's value under its `property-name`). The real values
// live in GalaxyEngine.js, but that module also self-instantiates a full engine (global click handler,
// engine-wide CSS injection, every component tag registered) as an import side effect, which is more than
// these unit tests need or want running. Only the pieces the select components actually read are stubbed here.
beforeEach(() => {
    window.galaxy_engine = {
        GALAXY_COMPONENT_TAG_NAMES: {
            SELECT: "galaxy-select",
            MULTI_SELECT: "galaxy-multi-select",
        },
    };

    window.galaxy_state_manager = {data: {}};

    document.body.innerHTML = "";
});
