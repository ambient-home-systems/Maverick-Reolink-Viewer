//#region node_modules/@lit/reactive-element/css-tag.js
var e = globalThis, t = e.ShadowRoot && (e.ShadyCSS === void 0 || e.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, n = Symbol(), r = /* @__PURE__ */ new WeakMap(), i = class {
	constructor(e, t, r) {
		if (this._$cssResult$ = !0, r !== n) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = e, this.t = t;
	}
	get styleSheet() {
		let e = this.o, n = this.t;
		if (t && e === void 0) {
			let t = n !== void 0 && n.length === 1;
			t && (e = r.get(n)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), t && r.set(n, e));
		}
		return e;
	}
	toString() {
		return this.cssText;
	}
}, a = (e) => new i(typeof e == "string" ? e : e + "", void 0, n), o = (e, ...t) => new i(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
	if (!0 === e._$cssResult$) return e.cssText;
	if (typeof e == "number") return e;
	throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
})(n) + e[r + 1], e[0]), e, n), s = (n, r) => {
	if (t) n.adoptedStyleSheets = r.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
	else for (let t of r) {
		let r = document.createElement("style"), i = e.litNonce;
		i !== void 0 && r.setAttribute("nonce", i), r.textContent = t.cssText, n.appendChild(r);
	}
}, c = t ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
	let t = "";
	for (let n of e.cssRules) t += n.cssText;
	return a(t);
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, h = globalThis, g = h.trustedTypes, ee = g ? g.emptyScript : "", te = h.reactiveElementPolyfillSupport, _ = (e, t) => e, ne = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? ee : null;
				break;
			case Object:
			case Array: e = e == null ? e : JSON.stringify(e);
		}
		return e;
	},
	fromAttribute(e, t) {
		let n = e;
		switch (t) {
			case Boolean:
				n = e !== null;
				break;
			case Number:
				n = e === null ? null : Number(e);
				break;
			case Object:
			case Array: try {
				n = JSON.parse(e);
			} catch {
				n = null;
			}
		}
		return n;
	}
}, re = (e, t) => !l(e, t), ie = {
	attribute: !0,
	type: String,
	converter: ne,
	reflect: !1,
	useDefault: !1,
	hasChanged: re
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var v = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = ie) {
		if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
			let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
			r !== void 0 && u(this.prototype, e, r);
		}
	}
	static getPropertyDescriptor(e, t, n) {
		let { get: r, set: i } = d(this.prototype, e) ?? {
			get() {
				return this[t];
			},
			set(e) {
				this[t] = e;
			}
		};
		return {
			get: r,
			set(t) {
				let a = r?.call(this);
				i?.call(this, t), this.requestUpdate(e, a, n);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(e) {
		return this.elementProperties.get(e) ?? ie;
	}
	static _$Ei() {
		if (this.hasOwnProperty(_("elementProperties"))) return;
		let e = m(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(_("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(_("properties"))) {
			let e = this.properties, t = [...f(e), ...p(e)];
			for (let n of t) this.createProperty(n, e[n]);
		}
		let e = this[Symbol.metadata];
		if (e !== null) {
			let t = litPropertyMetadata.get(e);
			if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (let [e, t] of this.elementProperties) {
			let n = this._$Eu(e, t);
			n !== void 0 && this._$Eh.set(n, e);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(e) {
		let t = [];
		if (Array.isArray(e)) {
			let n = new Set(e.flat(1 / 0).reverse());
			for (let e of n) t.unshift(c(e));
		} else e !== void 0 && t.push(c(e));
		return t;
	}
	static _$Eu(e, t) {
		let n = t.attribute;
		return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
	}
	addController(e) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
	}
	removeController(e) {
		this._$EO?.delete(e);
	}
	_$E_() {
		let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
		for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
		e.size > 0 && (this._$Ep = e);
	}
	createRenderRoot() {
		let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return s(e, this.constructor.elementStyles), e;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
	}
	enableUpdating(e) {}
	disconnectedCallback() {
		this._$EO?.forEach((e) => e.hostDisconnected?.());
	}
	attributeChangedCallback(e, t, n) {
		this._$AK(e, n);
	}
	_$ET(e, t) {
		let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
		if (r !== void 0 && !0 === n.reflect) {
			let i = (n.converter?.toAttribute === void 0 ? ne : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? ne : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? re)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
			this.C(e, t, n);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
		n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (e) {
			Promise.reject(e);
		}
		let e = this.scheduleUpdate();
		return e != null && await e, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (let [e, t] of this._$Ep) this[e] = t;
				this._$Ep = void 0;
			}
			let e = this.constructor.elementProperties;
			if (e.size > 0) for (let [t, n] of e) {
				let { wrapped: e } = n, r = this[t];
				!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
			}
		}
		let e = !1, t = this._$AL;
		try {
			e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
		} catch (t) {
			throw e = !1, this._$EM(), t;
		}
		e && this._$AE(t);
	}
	willUpdate(e) {}
	_$AE(e) {
		this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(e) {
		return !0;
	}
	update(e) {
		this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
	}
	updated(e) {}
	firstUpdated(e) {}
};
v.elementStyles = [], v.shadowRootOptions = { mode: "open" }, v[_("elementProperties")] = /* @__PURE__ */ new Map(), v[_("finalized")] = /* @__PURE__ */ new Map(), te?.({ ReactiveElement: v }), (h.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var y = globalThis, b = (e) => e, x = y.trustedTypes, ae = x ? x.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, oe = "$lit$", S = `lit$${Math.random().toFixed(9).slice(2)}$`, se = "?" + S, ce = `<${se}>`, C = document, w = () => C.createComment(""), le = (e) => e === null || typeof e != "object" && typeof e != "function", T = Array.isArray, ue = (e) => T(e) || typeof e?.[Symbol.iterator] == "function", de = "[ 	\n\f\r]", E = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, fe = /-->/g, pe = />/g, D = RegExp(`>|${de}(?:([^\\s"'>=/]+)(${de}*=${de}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), me = /'/g, he = /"/g, ge = /^(?:script|style|textarea|title)$/i, _e = (e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}), O = _e(1), k = _e(2), ve = Symbol.for("lit-noChange"), A = Symbol.for("lit-nothing"), ye = /* @__PURE__ */ new WeakMap(), j = C.createTreeWalker(C, 129);
function be(e, t) {
	if (!T(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return ae === void 0 ? t : ae.createHTML(t);
}
var xe = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = E;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === E ? c[1] === "!--" ? o = fe : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = D) : (ge.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = D) : o = pe : o === D ? c[0] === ">" ? (o = i ?? E, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? D : c[3] === "\"" ? he : me) : o === he || o === me ? o = D : o === fe || o === pe ? o = E : (o = D, i = void 0);
		let d = o === D && e[t + 1].startsWith("/>") ? " " : "";
		a += o === E ? n + ce : l >= 0 ? (r.push(s), n.slice(0, l) + oe + n.slice(l) + S + d) : n + S + (l === -2 ? t : d);
	}
	return [be(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, Se = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = xe(t, n);
		if (this.el = e.createElement(l, r), j.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = j.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(oe)) {
					let t = u[o++], n = i.getAttribute(e).split(S), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? De : r[1] === "?" ? Oe : r[1] === "@" ? ke : Ee
					}), i.removeAttribute(e);
				} else e.startsWith(S) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (ge.test(i.tagName)) {
					let e = i.textContent.split(S), t = e.length - 1;
					if (t > 0) {
						i.textContent = x ? x.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], w()), j.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], w());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === se) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(S, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += S.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = C.createElement("template");
		return n.innerHTML = e, n;
	}
};
function Ce(e, t, n = e, r) {
	if (t === ve) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = le(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = Ce(e, i._$AS(e, t.values), i, r)), t;
}
var we = class {
	constructor(e, t) {
		this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(e) {
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? C).importNode(t, !0);
		j.currentNode = r;
		let i = j.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new Te(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Ae(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = j.nextNode(), a++);
		}
		return j.currentNode = C, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, Te = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
	}
	get parentNode() {
		let e = this._$AA.parentNode, t = this._$AM;
		return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(e, t = this) {
		e = Ce(this, e, t), le(e) ? e === A || e == null || e === "" ? (this._$AH !== A && this._$AR(), this._$AH = A) : e !== this._$AH && e !== ve && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? ue(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== A && le(this._$AH) ? this._$AA.nextSibling.data = e : this.T(C.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = Se.createElement(be(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new we(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = ye.get(e.strings);
		return t === void 0 && ye.set(e.strings, t = new Se(e)), t;
	}
	k(t) {
		T(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(w()), this.O(w()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = b(e).nextSibling;
			b(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, Ee = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = A, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = A;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = Ce(this, e, t, 0), a = !le(e) || e !== this._$AH && e !== ve, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = Ce(this, r[n + o], t, o), s === ve && (s = this._$AH[o]), a ||= !le(s) || s !== this._$AH[o], s === A ? e = A : e !== A && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, De = class extends Ee {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === A ? void 0 : e;
	}
}, Oe = class extends Ee {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== A);
	}
}, ke = class extends Ee {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = Ce(this, e, t, 0) ?? A) === ve) return;
		let n = this._$AH, r = e === A && n !== A || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== A && (n === A || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Ae = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		Ce(this, e);
	}
}, je = y.litHtmlPolyfillSupport;
je?.(Se, Te), (y.litHtmlVersions ??= []).push("3.3.3");
var Me = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new Te(t.insertBefore(w(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Ne = globalThis, M = class extends v {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Me(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return ve;
	}
};
M._$litElement$ = !0, M.finalized = !0, Ne.litElementHydrateSupport?.({ LitElement: M });
var Pe = Ne.litElementPolyfillSupport;
Pe?.({ LitElement: M }), (Ne.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region src/api.ts
var Fe = (e) => e.callWS({ type: "reolink_viewer/devices" }), Ie = (e, t) => e.callWS({
	type: "reolink_viewer/device",
	device_id: t
}), Le = /* @__PURE__ */ new WeakMap();
function Re(e) {
	let t = Le.get(e.connection);
	return t || (t = e.callWS({ type: "reolink_viewer/catalog" }), Le.set(e.connection, t), t.catch(() => Le.delete(e.connection))), t;
}
var ze = (e, t) => e.callWS({
	type: "config/entity_registry/update",
	entity_id: t,
	disabled_by: null
});
function Be(e, t, n) {
	let r, i = !1, a = () => void 0, o = () => {
		let e = r;
		r = void 0, e && e().catch(() => void 0);
	};
	return {
		result: new Promise((s, c) => {
			a = c, e.connection.subscribeMessage((e) => {
				if (!i) switch (e.type) {
					case "progress":
						n(e.message);
						return;
					case "result":
						i = !0, o(), s(e.report);
						return;
					case "error":
						i = !0, o(), c(Error(e.message));
						return;
				}
			}, {
				type: "reolink_viewer/probe",
				...t
			}).then((e) => {
				r = e, i && o();
			}).catch((e) => {
				i = !0, c(N(e));
			});
		}),
		cancel: () => {
			i || (i = !0, o(), a(/* @__PURE__ */ Error("Probe cancelled")));
		}
	};
}
function N(e) {
	return e instanceof Error ? e : typeof e == "object" && e && "message" in e ? Error(String(e.message)) : Error(String(e));
}
var Ve = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/timeline/days",
	device_id: t,
	year: n,
	month: r
}), He = (e, t, n, r = 0) => e.callWS({
	type: "reolink_viewer/timeline/day",
	device_id: t,
	date: n,
	...r > 0 ? { max_age: r } : {}
}), Ue = (e, t = {}) => e.callWS({
	type: "reolink_viewer/events/recent",
	...t.date ? { date: t.date } : {},
	...t.maxAge ? { max_age: t.maxAge } : {},
	...t.background ? { background: !0 } : {}
}), We = (e, t, n) => e.callWS({
	type: "reolink_viewer/events/days",
	year: t,
	month: n
}), Ge = (e, t, n) => e.callWS({
	type: "reolink_viewer/events/seen",
	camera_id: t,
	start: n
}), Ke = (e) => e.callWS({
	type: "reolink_viewer/events/seen",
	all: !0
}), qe = (e) => e.callWS({ type: "reolink_viewer/timeline/warm" }), Je = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/playback/url",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	progressive: n,
	...r === void 0 ? {} : { at: Math.round(r) }
}), Ye = (e, t, n) => e.callWS({
	type: "reolink_viewer/playback/mse",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	...n === void 0 ? {} : { at: Math.round(n) }
});
function Xe(e) {
	return e.split("?")[0]?.split("/").at(-1) ?? "";
}
var Ze = (e, t) => e.callWS({
	type: "reolink_viewer/playback/release",
	tokens: t
}), Qe = (e, t) => e.callWS({
	type: "reolink_viewer/playback/cache_status",
	token: t
}), $e = (e, t) => e.callWS({
	type: "reolink_viewer/playback/prefetch",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream
}), et = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/thumbnail/urls",
	device_id: t,
	times: n,
	bucket: r
}), tt = (e, t) => e.callWS({
	type: "reolink_viewer/playback/media_info",
	device_id: t
}), nt = (e) => e.callWS({ type: "reolink_viewer/live/status" }), rt = (e) => e.callWS({ type: "reolink_viewer/live/cameras" }), it = (e) => ({
	connection_id: e.connectionId,
	stream: e.stream
}), at = (e, t) => e.callWS({
	type: "reolink_viewer/live/mse",
	...it(t)
}), ot = (e, t) => e.callWS({
	type: "reolink_viewer/live/frame",
	...it(t)
}), st = (e, t) => e.callWS({
	type: "reolink_viewer/live/state",
	...it(t)
}), ct = (e) => e.callWS({ type: "reolink_viewer/live/soak" }), lt = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/soak/count",
	device: t,
	...n
}), ut = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/soak/start",
	device: t,
	grid_open: n
}), dt = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/preload",
	...it(t),
	enabled: n
}), ft = (e) => e.callWS({ type: "web_rtc/ice_servers" }), pt = (e, t, n, r) => e.connection.subscribeMessage(r, {
	type: "reolink_viewer/live/webrtc",
	...it(t),
	offer: n
}), mt = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/candidate",
	session_id: t,
	candidate: n
}), ht = (e, t) => e.connection.subscribeMessage(t, { type: "reolink_viewer/live/images" }), gt = (e, t, n, r = {}) => e.connection.subscribeMessage(n, {
	type: "reolink_viewer/live/capacity",
	host_id: t,
	...r
}), _t = {
	camera: "Camera",
	nvr: "NVR",
	hub: "Home Hub"
}, vt = (e) => _t[e];
function yt(e) {
	let t = [];
	return e.codec && t.push(bt(e.codec)), e.width && e.height && t.push(`${e.width}×${e.height}`), e.frame_rate && t.push(`${e.frame_rate} fps`), e.bit_rate && t.push(`${e.bit_rate} kbps`), t.length ? t.join(" · ") : "unknown";
}
function bt(e) {
	switch (e.toLowerCase()) {
		case "h264": return "H.264";
		case "h265":
		case "hevc": return "H.265";
		default: return e;
	}
}
function xt(e) {
	return e === null ? "unknown" : e ? "on" : "off";
}
function St(e) {
	return `reolink-viewer-probe-${e.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
}
//#endregion
//#region src/icons.ts
var Ct = {
	person: k`<circle cx="12" cy="7" r="3.2" /><path d="M5.5 20.5v-1.8a6.5 6.5 0 0 1 13 0v1.8" />`,
	visitor: k`<path d="M6.2 16.5v-5.3a5.8 5.8 0 0 1 11.6 0v5.3l1.7 1.8H4.5z" /><path d="M10 21a2.1 2.1 0 0 0 4 0" />`,
	vehicle: k`<path d="M3.5 16.5v-3.8l2.1-5a1.6 1.6 0 0 1 1.5-1h9.8a1.6 1.6 0 0 1 1.5 1l2.1 5v3.8z" /><path d="M3.8 12.5h16.4" /><circle cx="7.6" cy="16.6" r="1.9" /><circle cx="16.4" cy="16.6" r="1.9" />`,
	animal: k`<circle cx="6.6" cy="10" r="1.7" /><circle cx="10" cy="6.4" r="1.7" /><circle cx="14" cy="6.4" r="1.7" /><circle cx="17.4" cy="10" r="1.7" /><path d="M8.3 17.6c0-3.1 1.7-5.6 3.7-5.6s3.7 2.5 3.7 5.6c0 1.6-1.3 2.1-2.3 1.7a3.7 3.7 0 0 0-2.8 0c-1 .4-2.3-.1-2.3-1.7z" />`,
	package: k`<path d="M4 7.6 12 3.6l8 4v8.8l-8 4-8-4z" /><path d="m4 7.6 8 4 8-4M12 11.6v8.8M8 5.6l8 4" />`,
	motion: k`<path d="M3 12.5h3.6l2.3-5.6 4.2 11 2.4-5.4H21" />`,
	picture: k`<rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />`,
	back: k`<path d="M19 12H5.5M11 5.5 4.5 12l6.5 6.5" />`,
	chevron: k`<path d="m9.5 5.5 6.5 6.5-6.5 6.5" />`,
	chevronBack: k`<path d="m14.5 5.5-6.5 6.5 6.5 6.5" />`,
	chevronDown: k`<path d="m5.5 9.5 6.5 6.5 6.5-6.5" />`,
	close: k`<path d="M6 6l12 12M18 6 6 18" />`,
	info: k`<circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" />`,
	enterFull: k`<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />`,
	exitFull: k`<path d="M9 4.5V9H4.5M15 4.5V9h4.5M19.5 15H15v4.5M4.5 15H9v4.5" />`,
	play: k`<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />`,
	pause: k`<path d="M8.5 5.5v13M15.5 5.5v13" />`,
	previous: k`<path d="M6 5.5v13M18.5 5.5 9 12l9.5 6.5z" />`,
	next: k`<path d="M18 5.5v13M5.5 5.5 15 12l-9.5 6.5z" />`,
	plus: k`<path d="M12 5v14M5 12h14" />`,
	minus: k`<path d="M5 12h14" />`,
	refresh: k`<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" />`,
	download: k`<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />`
};
function P(e) {
	return O`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${Ct[e]}</svg>`;
}
//#endregion
//#region src/styles.ts
var wt = o`
  :host {
    --rv-rail: #1b2a6e;
    --rv-on-rail: #f4f4f1;
    --rv-platform: #1b2a6e;
    --rv-recording: #1b2a6e;
    --rv-on-rail-muted: #b4bbd3;
    --rv-board: #111418;
    --rv-on-board: #f4f4f1;
    --rv-on-board-muted: #a9b0c4;
    --rv-ground: #f4f4f1;
    --rv-ground-2: #e9e9e4;
    --rv-text: #111418;
    --rv-muted: #5d6370;
    --rv-rule: rgba(17, 20, 24, 0.14);
    --rv-rule-strong: #111418;
    --rv-red: #e10600;
    --rv-action: #2140c4;
    --rv-on-action: #ffffff;
    --rv-fault: #f2b100;
    --rv-on-fault: #111418;
    --rv-fault-ink: #8a5a00;
    --rv-font: Barlow, system-ui, sans-serif;
    --rv-font-cond: "Barlow Semi Condensed", Barlow, system-ui, sans-serif;
    --rv-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    color-scheme: light;
  }
  :host([dark]) {
    --rv-ground: #0e1530;
    --rv-ground-2: #18224a;
    --rv-text: #eef0f6;
    --rv-muted: #9aa3c0;
    --rv-rule: rgba(238, 240, 246, 0.16);
    --rv-rule-strong: #eef0f6;
    --rv-red: #ff4a3d;
    --rv-action: #8fa6ff;
    --rv-on-action: #0e1530;
    --rv-fault-ink: #f2b100;
    --rv-platform: #3349a8;
    --rv-recording: #5a6cb4;
    color-scheme: dark;
  }
  :host {
    --primary-color: var(--rv-action);
    --accent-color: var(--rv-action);
    --primary-text-color: var(--rv-text);
    --secondary-text-color: var(--rv-muted);
    --text-primary-color: var(--rv-on-action);
    --primary-background-color: var(--rv-ground);
    --secondary-background-color: var(--rv-ground-2);
    --card-background-color: var(--rv-ground);
    --divider-color: var(--rv-rule);
    --error-color: var(--rv-fault-ink);
    --warning-color: var(--rv-fault);
    --disabled-color: var(--rv-muted);
    --ha-card-border-radius: 2px;
    --ha-card-box-shadow: none;
    --code-font-family: var(--rv-mono);
    --switch-checked-track-color: var(--rv-action);
    --switch-checked-button-color: var(--rv-action);
  }
`, F = o`
  :host {
    color: var(--rv-text);
    font-family: var(--rv-font);
    font-variant-numeric: tabular-nums;
  }
  ::selection {
    background: var(--rv-action);
    color: var(--rv-on-action);
  }
  /* A section of a page: ruled at the top, no box. */
  .card {
    overflow-wrap: anywhere;
    border-top: 2px solid var(--rv-rule-strong);
    padding: 14px 0 4px;
  }
  h2 {
    margin: 0 0 6px;
    font-family: var(--rv-font-cond);
    font-size: 22px;
    font-weight: 600;
    line-height: 1.15;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 17px;
    font-weight: 600;
  }
  p {
    max-width: 72ch;
  }
  .muted {
    color: var(--rv-muted);
  }
  .small {
    font-size: 14px;
  }
  .badge {
    display: inline-block;
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    padding: 0 7px;
    border: 1px solid var(--rv-rule);
    color: var(--rv-text);
    white-space: nowrap;
  }
  .badge.accent {
    background: var(--rv-action);
    border-color: var(--rv-action);
    color: var(--rv-on-action);
  }
  .badge.warning {
    background: var(--rv-fault);
    border-color: var(--rv-fault);
    color: var(--rv-on-fault);
  }
  button {
    font: inherit;
    font-weight: 500;
    min-height: 36px;
    padding: 6px 14px;
    border-radius: 2px;
    border: 1px solid var(--rv-rule-strong);
    background: transparent;
    color: var(--rv-text);
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--rv-ground-2);
  }
  button.primary {
    background: var(--rv-action);
    border-color: var(--rv-action);
    color: var(--rv-on-action);
  }
  button.primary:hover:not(:disabled) {
    background: var(--rv-action);
    filter: brightness(1.1);
  }
  button.danger {
    background: var(--rv-fault);
    border-color: var(--rv-fault);
    color: var(--rv-on-fault);
  }
  button.text,
  button.link {
    min-height: 0;
    background: transparent;
    border: none;
    color: var(--rv-action);
  }
  button.text {
    padding: 6px 4px;
  }
  button.link {
    padding: 0;
    text-align: left;
  }
  button.text:hover:not(:disabled),
  button.link:hover:not(:disabled) {
    background: transparent;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button svg {
    display: block;
    width: 20px;
    height: 20px;
  }
  button.with-icon {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :focus-visible {
    outline: 2px solid var(--rv-action);
    outline-offset: 2px;
  }
  input,
  select,
  textarea {
    font: inherit;
    color: var(--rv-text);
    background: var(--rv-ground);
    border: 1px solid var(--rv-rule-strong);
    border-radius: 2px;
    padding: 5px 8px;
    accent-color: var(--rv-action);
    caret-color: var(--rv-action);
  }
  input[type="checkbox"],
  input[type="radio"] {
    width: 18px;
    height: 18px;
    padding: 0;
    vertical-align: -3px;
  }
  a {
    color: var(--rv-action);
    text-underline-offset: 3px;
  }
  code,
  pre {
    font-family: var(--rv-mono);
  }
  .banner {
    padding: 12px 16px;
  }
  .banner.warning,
  .banner.error {
    background: var(--rv-fault);
    color: var(--rv-on-fault);
  }
  .banner.warning button,
  .banner.error button {
    border-color: var(--rv-on-fault);
    color: var(--rv-on-fault);
  }
  .banner.info {
    background: var(--rv-ground-2);
  }
  /* Facts as ruled rows: a label, then its value. */
  dl.facts {
    display: grid;
    grid-template-columns: minmax(0, 10em) minmax(0, 1fr);
    margin: 8px 0;
    font-size: 15px;
  }
  dl.facts dt,
  dl.facts dd {
    margin: 0;
    padding: 8px 0;
    border-bottom: 1px solid var(--rv-rule);
  }
  dl.facts dt {
    padding-right: 20px;
    color: var(--rv-muted);
  }
  /* A form: each setting's label in a column, then its controls. */
  .form {
    display: grid;
    grid-template-columns: minmax(0, 12em) minmax(0, 1fr);
    border-top: 1px solid var(--rv-rule);
  }
  .form > .label {
    padding: 13px 16px 13px 0;
    border-bottom: 1px solid var(--rv-rule);
    color: var(--rv-muted);
    font-size: 15px;
  }
  .form > .field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 22px;
    min-width: 0;
    padding: 8px 0;
    border-bottom: 1px solid var(--rv-rule);
  }
  .form > .field.stack {
    flex-direction: column;
    align-items: flex-start;
  }
  .form select {
    min-height: 36px;
    max-width: 100%;
  }
  label.option {
    display: inline-flex;
    align-items: flex-start;
    gap: 10px;
    min-height: 32px;
    padding: 4px 0;
    box-sizing: border-box;
    line-height: 1.35;
  }
  label.option input {
    flex: none;
    margin: 0;
  }
  label.option.nested {
    margin-left: 28px;
  }
  @media (max-width: 600px) {
    .form {
      grid-template-columns: minmax(0, 1fr);
    }
    .form > .label {
      padding: 12px 0 0;
      border-bottom: none;
    }
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  /* A report to read and copy: a sheet under a rule. */
  pre.report {
    margin: 0;
    padding: 14px 16px;
    max-height: 480px;
    overflow: auto;
    background: var(--rv-ground-2);
    border-top: 2px solid var(--rv-rule-strong);
    font-size: 12.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: text;
    -webkit-user-select: text;
  }
  /* A disclosure: its drawn arrow turns when open. */
  summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    cursor: pointer;
    list-style: none;
    font-weight: 500;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary svg {
    flex: none;
    width: 16px;
    height: 16px;
  }
  details[open] > summary svg {
    transform: rotate(180deg);
  }
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--rv-rule) transparent;
  }
`, Tt = "rv-navigate", Et = "rv-toast";
function I(e, t) {
	e.dispatchEvent(new CustomEvent(Tt, {
		detail: t,
		bubbles: !0,
		composed: !0
	}));
}
function L(e, t, n = "info") {
	e.dispatchEvent(new CustomEvent(Et, {
		detail: {
			message: t,
			kind: n
		},
		bubbles: !0,
		composed: !0
	}));
}
function Dt(e) {
	if (e.view === "live-check") return "#live-check";
	if (e.view === "soak") return "#soak";
	if (e.view === "list") return "#devices";
	if (e.view === "events") return e.date ? `#events/${e.date}` : "#events";
	if (e.view === "live") return "";
	let t = e.tab === "playback" && e.at !== void 0 ? `/${e.at}` : "";
	return `#device/${encodeURIComponent(e.id)}/${e.tab}${t}`;
}
function Ot(e) {
	if (e === "#live-check") return { view: "live-check" };
	if (e === "#soak") return { view: "soak" };
	if (e === "#devices") return { view: "list" };
	if (e === "#events") return { view: "events" };
	let t = /^#events\/(\d{4}-\d{2}-\d{2})$/.exec(e);
	if (t?.[1]) return {
		view: "events",
		date: t[1]
	};
	let n = /^#device\/([^/]+)(?:\/(overview|live|settings|playback)(?:\/(\d+))?)?$/.exec(e);
	if (!n?.[1]) return { view: "live" };
	let r = n[2], i = decodeURIComponent(n[1]);
	return r === "playback" && n[3] ? {
		view: "device",
		id: i,
		tab: r,
		at: Number(n[3])
	} : {
		view: "device",
		id: i,
		tab: r === "live" || r === "settings" || r === "playback" ? r : "overview"
	};
}
//#endregion
//#region src/components/device-list.ts
var kt = class extends M {
	static properties = {
		devices: { attribute: !1 },
		cameras: { attribute: !1 },
		hostId: { attribute: !1 }
	};
	constructor() {
		super(), this.cameras = [];
	}
	render() {
		let e = this.devices;
		if (!e) return O`<p class="muted">Loading devices…</p>`;
		if (!e.hosts.length && !e.cameras.length) return O`<section class="card">
        <h2>No Reolink devices</h2>
        <p class="muted">
          Set up your cameras, NVRs or Home Hubs in the Reolink integration first; they appear
          here once loaded.
        </p>
      </section>`;
		let t = new Map(e.cameras.map((e) => [e.id, e]));
		if (this.hostId !== void 0) {
			let n = e.hosts.find((e) => e.id === this.hostId);
			return n ? this._renderCameras(n, t) : O``;
		}
		let n = e.cameras.filter((e) => e.host_id === null);
		return O`
      ${e.hosts.map((e) => this._renderHost(e, t))}
      ${n.length ? O`<section class="card">
            <div class="head"><h2>Cameras added directly</h2></div>
            ${this._renderTable(n.map((e) => this._renderCamera(e)))}
          </section>` : A}
    `;
	}
	_renderHost(e, t) {
		let n = vt(e.kind);
		return O`<section class="card">
      <div class="head">
        <h2>
          <button class="link host" @click=${() => {
			I(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}>${e.name ?? e.entry_title}</button>
        </h2>
        <p class="muted">
          ${[
			n,
			e.model,
			e.sw_version && `firmware ${e.sw_version}`
		].filter(Boolean).join(" · ")}
        </p>
      </div>
      ${this._renderCameras(e, t)}
    </section>`;
	}
	_renderCameras(e, t) {
		let n = e.camera_ids.map((e) => t.get(e)).filter((e) => e !== void 0);
		return n.length ? this._renderTable(n.map((t) => this._renderCamera(t, e))) : O`<p class="muted">No cameras on this ${vt(e.kind)}.</p>`;
	}
	_renderTable(e) {
		return O`<div class="cols" aria-hidden="true">
        <span></span><span>Camera</span><span>Channel</span><span class="model">Model</span><span>State</span><span></span>
      </div>
      <ul class="devices">
        ${e}
      </ul>`;
	}
	_renderCamera(e, t) {
		let n = t ? e.connections.find((e) => e.host_id === t.id)?.channel : void 0, r = t !== void 0 && e.connections.some((e) => e.via === "direct"), i = this.cameras.find((t) => t.id === e.id)?.number, a = [r ? "Also added directly" : void 0, e.primary_view === "snapshot" ? "Snapshots only" : void 0].filter((e) => e !== void 0);
		return O`<li>
      <button
        class="row"
        @click=${() => {
			I(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}
      >
        <span class="plat-cell">${i === void 0 ? A : O`<span class="plat" aria-hidden="true">${i}</span>`}</span>
        <span class="name">${e.name ?? "Camera"}</span>
        <span class="ch muted">${n == null ? "Direct" : `Ch ${String(n + 1)}`}</span>
        <span class="model muted">${e.model ?? ""}</span>
        <span class="state">${At(e)}${a.length ? O`<span class="flags muted">${a.join(" · ")}</span>` : A}</span>
        ${P("chevron")}
      </button>
    </li>`;
	}
	static styles = [F, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 28px;
        container-type: inline-size;
      }
      .head {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 4px 14px;
        margin-bottom: 10px;
      }
      .head h2 {
        margin: 0;
      }
      .head p {
        margin: 0;
        font-size: 15px;
      }
      .host {
        font: inherit;
      }
      .cols,
      .row {
        display: grid;
        grid-template-columns: 34px minmax(0, 2fr) 72px minmax(0, 1.2fr) minmax(0, 1.6fr) 20px;
        column-gap: 14px;
        align-items: center;
      }
      .cols {
        padding: 0 4px 6px;
        border-bottom: 1px solid var(--rv-rule-strong);
        color: var(--rv-muted);
        font-size: 13px;
        font-weight: 500;
      }
      ul.devices {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        width: 100%;
        min-height: 52px;
        padding: 6px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .row:focus-visible {
        outline-offset: -2px;
      }
      .plat {
        width: max-content;
        min-width: 26px;
        height: 26px;
        padding: 0 4px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .name {
        font-size: 17px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .ch,
      .row .model {
        font-size: 15px;
      }
      .state {
        display: flex;
        flex-direction: column;
        font-size: 15px;
      }
      .offline {
        color: var(--rv-fault-ink);
        font-weight: 600;
      }
      .flags {
        font-size: 13px;
      }
      .row svg {
        width: 18px;
        height: 18px;
        color: var(--rv-muted);
      }
      @container (max-width: 640px) {
        .cols {
          display: none;
        }
        .row {
          grid-template-columns: 30px minmax(0, 1fr) auto 18px;
        }
        .model {
          display: none;
        }
        .plat-cell {
          grid-row: 1 / span 2;
        }
        .name {
          grid-column: 2;
          grid-row: 1;
        }
        .ch {
          grid-column: 2;
          grid-row: 2;
          font-size: 14px;
        }
        .state {
          grid-column: 3;
          grid-row: 1 / span 2;
          text-align: right;
        }
        .row svg {
          grid-column: 4;
          grid-row: 1 / span 2;
        }
      }
    `];
};
function At(e) {
	let t = e.status;
	return t.online === !1 ? O`<span class="offline">Offline</span>` : t.sleeping ? O`<span>Asleep</span>` : t.online ? O`<span>Online</span>` : A;
}
customElements.get("rv-device-list") || customElements.define("rv-device-list", kt);
//#endregion
//#region src/render-filter.ts
function jt(e, t, n) {
	if (e === t) return !1;
	if (!e || !t) return !0;
	for (let r of n) if (e[r] !== t[r]) return !0;
	return !1;
}
//#endregion
//#region src/live/check-util.ts
var Mt = [
	"avc1.640029",
	"avc1.64002A",
	"avc1.640033",
	"hvc1.1.6.L153.B0",
	"mp4a.40.2",
	"mp4a.40.5",
	"flac",
	"opus"
];
function Nt(e, t = !1) {
	return Mt.filter((n) => (!t || /^(avc1|hvc1)\./.test(n)) && e(`video/mp4; codecs="${n}"`)).join(",");
}
function Pt(e) {
	return [/live check (v[\w.-]+)/.exec(e)?.[1], /^Browser: (.+?)(?: · |$)/m.exec(e)?.[1]].filter((e) => e !== void 0).join(" · ");
}
function Ft(e) {
	let t = 0, n = 0, r = !1;
	for (let i of e) for (let e of Array.isArray(i.urls) ? i.urls : [i.urls]) /^turns?:/i.test(e) ? n += 1 : /^stun:/i.test(e) && (t += 1), /nabucasa|nabu\.casa/i.test(e) && (r = !0);
	return [`${t} STUN`, `${n} TURN${r && n ? " (Nabu Casa)" : ""}`].join(", ");
}
function It(e) {
	return e.map((e) => ({
		urls: e.urls,
		...e.username ? { username: e.username } : {},
		...e.credential ? { credential: e.credential } : {}
	}));
}
function Lt(e) {
	let t = /* @__PURE__ */ new Map();
	e.forEach((e) => {
		t.set(String(e.id), e);
	});
	let n;
	for (let e of t.values()) e.type === "transport" && typeof e.selectedCandidatePairId == "string" && (n = t.get(e.selectedCandidatePairId));
	n ??= [...t.values()].find((e) => e.type === "candidate-pair" && e.nominated && e.state === "succeeded");
	let r = {}, i = (e) => {
		let n = t.get(String(e));
		if (n) return `${typeof n.candidateType == "string" ? n.candidateType : "?"}/${typeof n.protocol == "string" ? n.protocol : "?"}${typeof n.relayProtocol == "string" ? ` (TURN over ${n.relayProtocol})` : ""}`;
	};
	if (n) {
		let e = i(n.localCandidateId), t = i(n.remoteCandidateId);
		e && (r.local = e), t && (r.remote = t), typeof n.currentRoundTripTime == "number" && (r.rttMs = Math.round(n.currentRoundTripTime * 1e3));
	}
	for (let e of t.values()) if (e.type === "inbound-rtp" && e.kind === "video") {
		let n = t.get(String(e.codecId));
		n && typeof n.mimeType == "string" && (r.codec = n.mimeType.replace(/^video\//, "").toLowerCase()), typeof e.frameWidth == "number" && (r.width = e.frameWidth), typeof e.frameHeight == "number" && (r.height = e.frameHeight), typeof e.framesDecoded == "number" && (r.framesDecoded = e.framesDecoded);
	}
	return r;
}
function R(e) {
	return e === void 0 ? "–" : `${(e / 1e3).toFixed(2)} s`;
}
function Rt(e) {
	if (!e.length) return;
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 ? t[n] : ((t[n - 1] ?? 0) + (t[n] ?? 0)) / 2;
}
function zt(e) {
	if (!e) return "";
	let t = [
		e.key_interval_ms === null ? void 0 : `key frames every ${R(e.key_interval_ms)}`,
		e.parameter_sets === null ? void 0 : `parameter sets: ${e.parameter_sets}`,
		e.frame_order ? `frame order: ${e.frame_order}` : void 0,
		e.ends ? `feed ended ${String(e.ends)}× (${e.last_end ?? "?"})` : void 0,
		`feed opened ${R(e.age_ms)} before`
	].filter(Boolean);
	return t.length ? `; ${t.join("; ")}` : "";
}
function Bt(e, t) {
	if (!t) return e;
	let n = [
		t.codec,
		t.width && t.height ? `${t.width}×${t.height}` : void 0,
		t.frame_rate ? `${t.frame_rate} fps` : void 0,
		t.bit_rate ? `${t.bit_rate} kbps` : void 0
	].filter(Boolean);
	return n.length ? `${e} (${n.join(", ")})` : e;
}
function Vt(e) {
	let t = [], n = typeof e.fill == "string" ? e.fill : e.fill ? `ch${e.fill.channel + 1}, ${Math.round(e.fill.duration_s / 60)} min recording` : "not run";
	t.push(`  logged-in clients (GetOnline) before: ${e.online_users_before}, after: ${e.online_users_after}`), t.push(`  download: ${n}${e.fill_alone_mbit_s == null ? "" : `, alone ${e.fill_alone_mbit_s} Mbit/s`}`);
	for (let n of e.levels) {
		let e = n.first_frame_s == null ? "" : `, first frame ${n.first_frame_s} s`, r = n.fill ? `, download ${n.fill.mbit_s ?? "?"} Mbit/s${n.fill.error ? ` (${n.fill.error})` : ""}` : "", i = n.streams.map((e) => {
			let t = e.expected_fps ? `${e.fps}/${e.expected_fps}` : `${e.fps}`, n = e.longest_gap_s > 1 ? ` gap ${e.longest_gap_s} s` : "";
			return `${e.stream} ${t} fps${n}${e.error ? ` (${e.error})` : ""}`;
		}).join("; "), a = n.online_users == null ? "" : ` · clients ${n.online_users}`;
		t.push(`  L${n.level} + ${n.added}${e}${r}${a}: ${i}`);
	}
	let r = e.verdict;
	return t.push(r.first_failing_level === null ? "  verdict: every level kept up" : `  verdict: level ${r.first_failing_level} fails or slows down: ${r.reasons.join("; ")}`), t;
}
function Ht(e, t) {
	let n = new URL(e, t);
	return n.protocol = n.protocol === "https:" ? "wss:" : "ws:", n.toString();
}
//#endregion
//#region src/live/data.ts
var Ut = class {
	_host;
	cameras;
	images = {};
	iceServers;
	error;
	_hass;
	_connected = !1;
	_started = !1;
	_run = 0;
	_unsubscribe;
	constructor(e) {
		this._host = e, e.addController(this);
	}
	set hass(e) {
		this._hass = e, this._maybeLoad();
	}
	hostConnected() {
		this._connected = !0, this._maybeLoad();
	}
	hostDisconnected() {
		this._connected = !1, this._reset();
	}
	reload() {
		this._reset(), this.error = void 0, this._maybeLoad();
	}
	_reset() {
		this._started = !1, this._run += 1, this._unsubscribe?.().catch(() => void 0), this._unsubscribe = void 0;
	}
	_maybeLoad() {
		this._hass && this._connected && !this._started && (this._started = !0, this._load(this._hass, this._run));
	}
	async _load(e, t) {
		let n = ht(e, (e) => {
			t === this._run && (this.images = {
				...this.images,
				...e.images
			}, this._host.requestUpdate());
		}), r = ft(e).then(It, () => []);
		try {
			let [i, { cameras: a }, o] = await Promise.all([
				n,
				rt(e),
				r
			]);
			if (t !== this._run) {
				i().catch(() => void 0);
				return;
			}
			this._unsubscribe = i, this.cameras = a, this.iceServers = o, this.error = void 0;
		} catch (e) {
			if (n.then((e) => e()).catch(() => void 0), t !== this._run) return;
			this.error = N(e).message;
		}
		this._host.requestUpdate();
	}
};
function Wt(e, t) {
	let n = t.keep_warm_entity;
	return n && e?.states[n]?.state === "on" ? !0 : z(t)?.streams.sub?.warm === !0;
}
function z(e) {
	return e.connections.find((e) => e.via === "nvr") ?? e.connections[0];
}
function Gt(e, t) {
	return e.find((e) => e.id === t || e.connections.some((e) => e.connection_id === t));
}
//#endregion
//#region src/plain.ts
var Kt = {
	good: "Good",
	fine: "Fine",
	slow: "Slow",
	problem: "Problem",
	note: "Note",
	pending: "Not yet"
}, qt = {
	good: "as it should be",
	fine: "a little slower, nothing to do",
	slow: "works, but worth a look",
	problem: "something is wrong",
	note: "for your information",
	pending: "still to come"
}, Jt = " What to do: ";
function B(e) {
	if (e < 100) return "under 0.1 s";
	let t = e / 1e3;
	return t < 10 ? `${t.toFixed(1)} s` : `${String(Math.round(t))} s`;
}
function V(e, t, n) {
	return e === void 0 ? "problem" : e < t ? "good" : e < n ? "fine" : "slow";
}
function Yt(e) {
	return [
		"problem",
		"slow",
		"fine",
		"good",
		"pending",
		"note"
	].find((t) => e.includes(t)) ?? "note";
}
function Xt(e) {
	if (e.length) return [...e].sort((e, t) => e - t)[Math.floor((e.length - 1) / 2)];
}
function H(e, t, n = `${t}s`) {
	return `${String(e)} ${e === 1 ? t : n}`;
}
function Zt(e) {
	return [`In short: ${e.headline}`, ...e.findings.map((e) => `- ${Kt[e.grade]}: ${e.text}${e.advice ? `${Jt}${e.advice}` : ""}`)];
}
function Qt(e) {
	let t = e.split("\n"), n = t.findIndex((e) => e.startsWith("In short: "));
	if (n < 0) return;
	let r = new Map(Object.entries(Kt).map(([e, t]) => [t, e])), i = [];
	for (let e of t.slice(n + 1)) {
		let t = /^- (Good|Fine|Slow|Problem|Note|Not yet): (.*)$/.exec(e);
		if (!t) break;
		let [, n, a] = t, [o = "", s] = a.split(Jt);
		i.push({
			grade: r.get(n) ?? "note",
			text: o,
			...s ? { advice: s } : {}
		});
	}
	return {
		headline: t[n]?.slice(10) ?? "",
		findings: i
	};
}
var $t = 6e4;
function en(e) {
	return rn(e).text;
}
function tn(e) {
	return rn(e).inShort;
}
var nn = "Open Reolink → Live whenever it suits you; the hours add up across sittings and devices.";
function rn(e) {
	let { samples: t, run: n } = e, r = [], i = e.sampleS * 1e3, a = [`Reolink Viewer soak report v${e.version} · ${new Date(e.now).toLocaleString()}`], o = 0;
	if (n) {
		let t = Math.max(0, e.now - n.started_at);
		o = Math.min(n.visible_ms, t) / 36e5;
		let r = Object.entries(n.devices).sort(([, e], [, t]) => t - e);
		a.push(`Soak started ${new Date(n.started_at).toLocaleString()} (${an(t)} h ago) · grid open ${an(n.open_ms)} h, visible ${o.toFixed(1)} h · opened ${n.opens} time${n.opens === 1 ? "" : "s"}`, `Reported by: ${r.length ? r.map(([t, n]) => `${t} (${on(e.now - n)})`).join(", ") : "no grid yet"}`);
	} else a.push("No grid has reported yet: open Reolink → Live and leave it showing; its hours add up.");
	let s = t.at(0), c = t.at(-1);
	if (!s || !c) {
		let t = Math.round(e.warmupS / 60);
		return a.push("", e.startedAt === null ? `No samples yet: Home Assistant is still starting. The first comes ${t} minutes after it has, once live view is up.` : `No samples yet: Home Assistant started at ${new Date(e.startedAt).toLocaleString()}. The first comes ${t} minutes after, once live view is up (go2rtc and the kept-warm feeds).`), r.push({
			grade: "pending",
			text: e.startedAt === null ? `Home Assistant is still starting. Its first measurement comes ${String(t)} minutes after it has.` : `Home Assistant's first measurement comes ${String(t)} minutes after it started (at ${new Date(e.startedAt).toLocaleTimeString()}).`
		}), n || r.push({
			grade: "pending",
			text: "The live board has not been on screen yet.",
			advice: nn
		}), {
			text: a.join("\n"),
			inShort: {
				headline: "The test has not started yet.",
				findings: r
			}
		};
	}
	let l = c.at - s.at;
	a.push(`Home Assistant's samples: ${t.length} over ${an(l)} h, since ${new Date(s.at).toLocaleString()} (every ${Math.round(e.sampleS / 60)} min; the last ${Math.round(e.keepS / 3600)} h are kept)`, "");
	let u = [], d = t.map((e) => e.go2rtc.memory_kb).filter((e) => e !== null), f = c.go2rtc.restarts - s.go2rtc.restarts, p = t.filter((e) => e.go2rtc.state !== "running").length;
	a.push(`go2rtc: ${c.go2rtc.state} · restarts ${s.go2rtc.restarts} → ${c.go2rtc.restarts}` + (d.length ? ` · memory ${U(d[0] ?? 0)} → ${U(d.at(-1) ?? 0)} MB (peak ${U(Math.max(...d))} MB)` : " · memory not known")), u.push(f === 0 && p === 0 ? ["✓", "go2rtc ran throughout: no restart"] : ["✗", `go2rtc restarted ${f} time${f === 1 ? "" : "s"}${p ? `, and was not running in ${p} sample${p === 1 ? "" : "s"}` : ""}`]), r.push(f === 0 && p === 0 ? {
		grade: "good",
		text: "The video service (go2rtc) ran the whole time without restarting."
	} : {
		grade: "problem",
		text: `The video service (go2rtc) restarted ${H(f, "time")}${p ? ` and was down for about ${String(p * Math.round(e.sampleS / 60))} minutes` : ""}.`,
		advice: "Look for go2rtc errors in Home Assistant's log, and include the details below if you report it."
	});
	let m = d.at(0), h = d.at(-1);
	m !== void 0 && h !== void 0 && (u.push(h <= m * 2 ? ["✓", `go2rtc's memory steady: ${U(m)} → ${U(h)} MB`] : ["⚠", `go2rtc's memory grew: ${U(m)} → ${U(h)} MB`]), r.push(h <= m * 2 ? {
		grade: "good",
		text: `The video service's memory use stayed steady (about ${U(h)} MB).`
	} : {
		grade: "note",
		text: `The video service's memory use grew from ${U(m)} to ${U(h)} MB.`,
		advice: "If it keeps growing, restart Home Assistant and report it with the details below."
	})), a.push(`WebRTC sessions: ${s.webrtc_sessions} → ${c.webrtc_sessions} (peak ${((e) => Math.max(...t.map(e)))((e) => e.webrtc_sessions)})`, `MSE feeds: ${s.feeds.feeds} → ${c.feeds.feeds}, kept warm ${s.feeds.warm} → ${c.feeds.warm}, viewers ${s.feeds.viewers} → ${c.feeds.viewers} · feeds dropped ${s.feeds.ends} → ${c.feeds.ends}`, "Stream slots in use (the sessions to the cameras), per host:");
	let g = t.filter((e) => e.webrtc_sessions === 0 && e.feeds.viewers === 0), ee = g.at(0), te = g.at(-1), _ = g.length >= 2 && ee !== void 0 && te !== void 0, ne = _ ? ee : s, re = _ ? te : c, ie = (e, t) => e.hosts.find((e) => e.name === t)?.streams ?? 0, v = [], y = [], b = [], x = [], ae = [], oe = [], S = 0, se = [...new Set(t.flatMap((e) => e.hosts.map((e) => e.name)))];
	for (let e of se) {
		let n = t.map((t) => t.hosts.find((t) => t.name === e)), r = n.find((e) => e !== void 0), i = n.at(-1), o = i?.limit ?? r?.limit ?? 0, s = Math.max(...n.map((e) => e?.streams ?? 0)), c = Math.max(...n.map((e) => e?.waiting ?? 0)), l = n.map((e) => e?.cpu).filter((e) => e != null);
		a.push(`  ${e}: ${n[0]?.streams ?? 0} → ${i?.streams ?? 0} of ${o} (peak ${s}${c ? `, up to ${c} waiting` : ""}) · CPU ${l.length ? `${l.at(0)}% → ${l.at(-1)}% (peak ${Math.max(...l)}%)` : "not reported"}`);
		let u = ie(ne, e), d = ie(re, e);
		b.push(`${e} ${u} → ${d}`), d > u && (v.push(`${e} ${u} → ${d}`), y.push(`${e}: ${String(u)} to ${String(d)}`)), n.some((e) => e !== void 0 && e.streams > e.limit) && x.push(e), l.length && (ae.push(`${e} peak ${Math.max(...l)}%`), oe.push(`${e} ${String(Math.max(...l))}%`), S = Math.max(S, ...l));
	}
	_ && a.push(`While nobody watched (${g.length} samples, ${new Date(ne.at).toLocaleString()} → ${new Date(re.at).toLocaleString()}): ${b.join(", ")}`), u.push(v.length ? ["✗", _ ? `Camera sessions grew while nobody watched: ${v.join(", ")}` : `Camera sessions grew: ${v.join(", ")} (close full screen before the report)`] : ["✓", _ ? "No growth in camera sessions: while nobody watched, no host held more stream slots at the end than at the start" : "No growth in camera sessions: each host ends with no more stream slots in use than it started with"], x.length ? ["✗", `Above the stream limit: ${x.join(", ")}`] : ["✓", "Within the stream limits: no host above its limit"], ["–", `Camera CPU (Phase 0 set no CPU limit): ${ae.length ? ae.join(", ") : "not reported (the hosts' CPU sensors are off)"}`]), r.push(v.length ? {
		grade: "problem",
		text: `Connections to your cameras piled up (${y.join(", ")})${_ ? " while nobody was watching" : ""}.`,
		advice: "Restarting Home Assistant clears them. Please report it with the details below."
	} : {
		grade: "good",
		text: "Connections to your cameras did not pile up."
	}, x.length ? {
		grade: "problem",
		text: `${x.join(", ")} ${x.length === 1 ? "was" : "were"} asked for more video streams than ${x.length === 1 ? "it" : "they"} can serve.`,
		advice: "Keep fewer cameras warm, and close full screen on other devices."
	} : {
		grade: "good",
		text: "No camera or NVR was asked for more video streams than it can serve."
	}), oe.length && r.push(S < 85 ? {
		grade: "note",
		text: `Processor load at its highest: ${oe.join(", ")}, ${S < 60 ? "well within what it can handle" : "busy but coping"}.`
	} : {
		grade: "slow",
		text: `Processor load at its highest: ${oe.join(", ")}, near its limit.`,
		advice: "Keep fewer cameras warm, or watch fewer of them at once."
	});
	let ce = [...new Set(t.flatMap((e) => e.battery.map((e) => e.camera)))];
	ce.length || (a.push("Battery cameras: none on battery"), u.push(["–", "Battery cameras: none on battery"]));
	for (let e of ce) {
		let n = t.map((t) => t.battery.find((t) => t.camera === e)).filter((e) => e !== void 0).filter((e) => !e.watched), i = n.filter((e) => e.sleeping === !0).length;
		a.push(`Battery camera ${e}: asleep in ${i} of ${n.length} samples while not watched`), u.push(n.length ? i ? ["✓", `${e} slept while not watched`] : ["✗", `${e} never slept while not watched`] : ["–", `${e}: watched in every sample`]), r.push(n.length ? i ? {
			grade: "good",
			text: `${e} slept when nobody was watching, saving its battery.`
		} : {
			grade: "problem",
			text: `${e} stayed awake when nobody was watching, which drains its battery.`,
			advice: "Make sure nothing else streams it (another app, or a dashboard card showing it live)."
		} : {
			grade: "note",
			text: `${e} was being watched the whole time, so whether it sleeps could not be checked.`
		});
	}
	let C = Object.entries(n?.tiles ?? {});
	a.push("Tiles (plays · drops · failed starts):"), C.length || a.push(n ? "  none counted yet" : "  no grid yet");
	let w = [], le = [];
	for (let [e, t] of C) {
		a.push(`  ${e}: ${t.plays} · ${t.drops} · ${t.failures}`);
		let n = t.drops + t.failures;
		n > Math.max(2, o) && (w.push(`${e} (${n} in ${o.toFixed(1)} h)`), le.push(`${e} (${H(n, "time")} in ${o.toFixed(1)} hours)`));
	}
	n && r.unshift(w.length ? {
		grade: "problem",
		text: `Live video kept dropping and reconnecting on ${le.join(", ")}.`,
		advice: "Check those cameras' network (Wi-Fi signal or cable) and power."
	} : {
		grade: "good",
		text: "Live video kept playing: no camera kept dropping and reconnecting."
	}), u.unshift(n ? w.length ? ["✗", `Reconnect loops: ${w.join(", ")}`] : ["✓", "No reconnect loops: no tile dropped or failed to start more than once an hour"] : ["–", "Reconnect loops: no grid has reported yet"]);
	let T = l / 36e5;
	u.push(T >= 24 ? ["✓", `Home Assistant ran live view ${T.toFixed(1)} h (24 needed)`] : ["✗", `Home Assistant's samples cover ${T.toFixed(1)} h of 24: it has to run that long without restarting (no page needs to be open)`], n ? o >= 8 ? ["✓", `The grid was visible ${o.toFixed(1)} h (8 needed), opened ${n.opens} time${n.opens === 1 ? "" : "s"}`] : ["✗", `The grid has been visible ${o.toFixed(1)} h of 8: open it whenever it suits; the hours add up across sittings and devices`] : ["✗", "The grid has been visible 0.0 h of 8: no grid has reported yet"]), r.push(T >= 24 ? {
		grade: "good",
		text: `Home Assistant ran live view for ${T.toFixed(1)} hours.`
	} : {
		grade: "pending",
		text: `Home Assistant has run live view for ${T.toFixed(1)} of 24 hours.`,
		advice: "Leave Home Assistant running; no page needs to be open."
	}, n ? o >= 8 ? {
		grade: "good",
		text: `The live board was on screen for ${o.toFixed(1)} hours, opened ${H(n.opens, "time")}.`
	} : {
		grade: "pending",
		text: `The live board has been on screen for ${o.toFixed(1)} of 8 hours.`,
		advice: nn
	} : {
		grade: "pending",
		text: "The live board has not been on screen yet.",
		advice: nn
	}), n && e.startedAt !== null && e.startedAt > n.started_at + i && (u.push(["–", `Home Assistant started again at ${new Date(e.startedAt).toLocaleString()}, after the soak began: its samples start then; the grid's hours carry on`]), r.push({
		grade: "note",
		text: `Home Assistant restarted at ${new Date(e.startedAt).toLocaleString()}, after the test began: its hours count from then. The live board's hours carry on.`
	}));
	let ue = Math.floor(l / i) + 1;
	t.length < .9 * ue && (u.push(["⚠", `${t.length} samples of about ${ue} in ${T.toFixed(1)} h: sampling stopped for a while`]), r.push({
		grade: "note",
		text: `Some measurements are missing (${String(t.length)} of about ${String(ue)}): Home Assistant was busy or stopped for a while.`
	}));
	let de = u.filter(([e]) => e === "✗").length, E = r.filter((e) => e.grade === "problem").length, fe = r.some((e) => e.grade === "pending"), pe = {
		headline: E ? `${H(E, "problem")} found${fe ? " so far" : ""}.` : fe ? "Running: nothing wrong so far." : "Passed: live view held up for the whole test.",
		findings: r
	};
	return a.push("", ...Zt(pe)), a.push("", "Verdict:", ...u.map(([e, t]) => `${e} ${t}`)), a.push("", de ? `Not passed: ${de} ${de === 1 ? "criterion" : "criteria"} not met.` : "Passed."), {
		text: a.join("\n"),
		inShort: pe
	};
}
function an(e) {
	return (Math.max(0, e) / 36e5).toFixed(1);
}
function U(e) {
	return (e / 1024).toFixed(1);
}
function on(e) {
	let t = Math.max(0, e) / 6e4;
	return t < 1 ? "now" : t < 60 ? `${Math.floor(t)} min ago` : `${(t / 60).toFixed(1)} h ago`;
}
var W = new class {
	_device;
	_now;
	_opens = 0;
	_openMs = 0;
	_visibleMs = 0;
	_tiles = /* @__PURE__ */ new Map();
	_openSince;
	_visibleSince;
	_timer;
	_sending = Promise.resolve();
	constructor(e = () => sn(navigator.userAgent), t = () => Date.now()) {
		this._device = e, this._now = t;
	}
	get open() {
		return this._openSince !== void 0;
	}
	opened(e, t) {
		let n = this._now();
		this._opens += 1, this._openSince = n, this._visibleSince = t ? n : void 0, clearInterval(this._timer), this._timer = setInterval(() => {
			let t = e();
			t && this.flush(t);
		}, $t);
	}
	closed() {
		this._accrue(), this._openSince = void 0, this._visibleSince = void 0, clearInterval(this._timer), this._timer = void 0;
	}
	visibility(e) {
		this.open && (this._accrue(), this._visibleSince = e ? this._now() : void 0);
	}
	count(e, t) {
		let n = this._tiles.get(e);
		n || (n = {
			plays: 0,
			drops: 0,
			failures: 0
		}, this._tiles.set(e, n)), n[t] += 1;
	}
	discard() {
		this._accrue(), this._take();
	}
	flush(e) {
		return this._sending = this._sending.then(() => this._send(e)), this._sending;
	}
	async _send(e) {
		this._accrue();
		let t = this._take();
		if (t) try {
			await lt(e, this._device(), t);
		} catch {
			this._putBack(t);
		}
	}
	_accrue() {
		let e = this._now();
		this._openSince !== void 0 && (this._openMs += e - this._openSince, this._openSince = e), this._visibleSince !== void 0 && (this._visibleMs += e - this._visibleSince, this._visibleSince = e);
	}
	_take() {
		let e = {
			opens: this._opens,
			open_ms: Math.round(this._openMs),
			visible_ms: Math.round(this._visibleMs),
			tiles: [...this._tiles].map(([e, t]) => ({
				camera: e,
				...t
			}))
		};
		return this._opens = 0, this._openMs = 0, this._visibleMs = 0, this._tiles = /* @__PURE__ */ new Map(), !e.opens && !e.open_ms && !e.visible_ms && !e.tiles.length ? void 0 : e;
	}
	_putBack(e) {
		this._opens += e.opens, this._openMs += e.open_ms, this._visibleMs += e.visible_ms;
		for (let { camera: t, plays: n, drops: r, failures: i } of e.tiles) {
			let e = this._tiles.get(t) ?? {
				plays: 0,
				drops: 0,
				failures: 0
			};
			this._tiles.set(t, {
				plays: e.plays + n,
				drops: e.drops + r,
				failures: e.failures + i
			});
		}
	}
}();
function sn(e) {
	let t = /iPhone/.test(e) ? "iPhone" : /iPad/.test(e) ? "iPad" : /Android/.test(e) ? "Android" : /Macintosh|Mac OS X/.test(e) ? "Mac" : /Windows/.test(e) ? "Windows" : /Linux|X11/.test(e) ? "Linux" : "Browser", n = /Home ?Assistant\//.test(e) ? "Home Assistant app" : /Edg(A|iOS)?\//.test(e) ? "Edge" : /Firefox\/|FxiOS\//.test(e) ? "Firefox" : /Chrome\/|CriOS\//.test(e) ? "Chrome" : /Safari\//.test(e) ? "Safari" : void 0;
	return n ? `${t} · ${n}` : t;
}
//#endregion
//#region src/playback/codec.ts
function cn() {
	let e = navigator.mediaCapabilities, t = e?.decodingInfo;
	return t ? t.bind(e) : void 0;
}
async function ln(e, t = cn()) {
	if (!e) return {
		main: !0,
		reason: "not tried yet: falls back to SD if this browser cannot play it"
	};
	if (!e.width || !e.height) return {
		main: !1,
		reason: "main stream size unknown"
	};
	let n = `${e.codec} at ${e.width}×${e.height}`;
	if (!t) return {
		main: !1,
		reason: "this browser cannot report what it decodes"
	};
	try {
		let r = await t({
			type: "file",
			video: {
				contentType: `video/mp4; codecs="${e.codec}"`,
				width: e.width,
				height: e.height,
				bitrate: 8e6,
				framerate: 25
			}
		});
		return r.supported ? r.smooth ? {
			main: !0,
			reason: `${n} is supported`
		} : {
			main: !1,
			reason: `${n} would not play smoothly here`
		} : {
			main: !1,
			reason: `this browser cannot decode ${n}`
		};
	} catch {
		return {
			main: !1,
			reason: `this browser cannot check ${n}`
		};
	}
}
function un(e = navigator.userAgent) {
	return !(/AppleWebKit/.test(e) && !/Chrome|Chromium|CriOS|Edg|Android|FxiOS/.test(e));
}
//#endregion
//#region src/live/hd.ts
var dn = 4096, fn = Mt.find((e) => e.startsWith("hvc1.")) ?? "hvc1.1.6.L153.B0";
async function pn(e, t = cn()) {
	let n = (t) => e.streams.ext ? {
		stream: "ext",
		reason: `ext: ${t}`
	} : {
		stream: null,
		reason: `SD only: ${t}, and there is no ext stream`
	}, r = e.streams.main;
	if (!r) return n("no main stream");
	let i = r.encoding, a = i?.width ?? void 0, o = i?.height ?? void 0, s = a && o ? `${a}×${o}` : void 0;
	if (a && a > 4096) return n(`the main stream's ${s ?? `${a} pixels`} is wider than ${dn} pixels`);
	let c = i?.codec?.toLowerCase();
	if (c === "h264") return {
		stream: "main",
		reason: `main: H.264${s ? ` at ${s}` : ""}`
	};
	if (c !== "h265" && c !== "hevc") return n(`the main stream's codec is ${c ?? "unknown"}`);
	if (!a || !o || !s) return n("the main stream is H.265 at an unknown size");
	if (!t) return n("this browser cannot say whether it decodes H.265");
	try {
		let e = await t({
			type: "media-source",
			video: {
				contentType: `video/mp4; codecs="${fn}"`,
				width: a,
				height: o,
				bitrate: (i?.bit_rate ?? 8e3) * 1e3,
				framerate: i?.frame_rate ?? 25
			}
		});
		return e.supported ? e.smooth ? {
			stream: "main",
			reason: `main: H.265 at ${s}, smooth here`
		} : n(`H.265 at ${s} would not play smoothly here`) : n(`this browser cannot decode H.265 at ${s}`);
	} catch {
		return n(`this browser cannot check H.265 at ${s}`);
	}
}
//#endregion
//#region src/playback/mse-feeder.ts
var mn = class extends Error {}, hn = 4e3, gn = 2e4, _n = 12e4, vn = 16777216, yn = 50331648, bn = 1e3;
function G() {
	let e = window;
	if (typeof e.ManagedMediaSource == "function") return "ManagedMediaSource";
	if (typeof e.MediaSource == "function") return "MediaSource";
}
function xn(e) {
	return window[e];
}
function Sn(e) {
	let t = [];
	for (let n = 0; n < e.length; n += 1) {
		let r = {
			start: e.start(n),
			end: e.end(n)
		}, i = t.at(-1);
		i && r.start - i.end < .5 ? i.end = Math.max(i.end, r.end) : t.push(r);
	}
	return t;
}
function Cn(e, t) {
	let n = Math.min(30 * Math.max(1, e), 240);
	return t > 0 ? Math.max(4, Math.min(n, yn / t)) : n;
}
function wn(e) {
	return e instanceof DOMException && e.name === "QuotaExceededError";
}
var Tn = class {
	_video;
	_src;
	_onError;
	stats;
	_source;
	_buffer;
	_url;
	_pending;
	_next;
	_runStartS;
	_endS;
	_bytesPerSecond = 0;
	_ready = !1;
	_closed = !1;
	_listeners = [];
	constructor(e, t, n) {
		this._video = e, this._src = t, this._onError = n, this.stats = {
			api: "MediaSource",
			mime: "",
			windows: 0,
			bytes: 0,
			lastWaitMs: void 0,
			trims: 0,
			fetching: !1
		};
	}
	get closed() {
		return this._closed;
	}
	get around() {
		let e = this._video.currentTime, t = this._buffer ? this._rangeAt(e) : void 0;
		return t ? {
			ahead: t.end - e,
			behind: e - t.start
		} : {
			ahead: 0,
			behind: 0
		};
	}
	async start(e) {
		let t = G();
		if (!t) throw new mn("this browser has no MediaSource");
		this.stats.api = t;
		let n = xn(t), r = new n();
		this._source = r, this._video.disableRemotePlayback = !0, this._url = URL.createObjectURL(r);
		let i = new Promise((e) => {
			r.addEventListener("sourceopen", () => {
				e();
			}, { once: !0 });
		});
		if (this._video.src = this._url, await i, this._gone()) return;
		let a = await this._get("init"), o = a.headers.get("X-RV-Mime") ?? "";
		if (this.stats.mime = o, !o || !n.isTypeSupported(o)) throw new mn(`MSE cannot play ${o || "this recording"}`);
		let s = new Uint8Array(await a.arrayBuffer());
		if (!this._gone()) {
			this._buffer = r.addSourceBuffer(o), this._src.durationMs > 0 && (r.duration = this._src.durationMs / 1e3);
			for (let e of [
				"timeupdate",
				"seeking",
				"ratechange",
				"progress"
			]) this._listen(this._video, e, this._pump);
			this._listen(this._video, "waiting", this._jumpGap), this._listen(r, "startstreaming", this._pump), this._listen(this._buffer, "updateend", this._pump), this._listen(this._buffer, "bufferedchange", this._pump), await this._append(s), await this._fetch({ at: e }, hn, !0), e > 0 && this._video.currentTime === 0 && (this._video.currentTime = e / 1e3), this._ready = !0, this._pump();
		}
	}
	destroy() {
		this._closed = !0, this._pending?.controller.abort(), this._pending = void 0;
		for (let [e, t, n] of this._listeners) e.removeEventListener(t, n);
		this._listeners.length = 0, this._url && URL.revokeObjectURL(this._url);
	}
	_gone() {
		return this._closed;
	}
	_settle(e) {
		this._pending && this._pending.controller === e && (this._pending = void 0), this.stats.fetching = this._pending !== void 0;
	}
	_listen(e, t, n) {
		e.addEventListener(t, n), this._listeners.push([
			e,
			t,
			n
		]);
	}
	async _get(e, t) {
		let n = await this._src.fetch(`${this._src.base}/${e}`, t ? { signal: t } : {});
		if (!n.ok) {
			let e = await n.text().catch(() => "");
			throw e.startsWith("not playable as fragments") ? new mn(e) : Error(`HTTP ${n.status}${e ? `: ${e}` : ""}`);
		}
		return n;
	}
	_pump = () => {
		let e = this._buffer;
		if (this._closed || !this._ready || !e) return;
		let t = this._video.currentTime, n = this._rangeAt(t);
		if (!n && this._endS !== void 0 && t >= this._endS - .5) return;
		let r = this._pending;
		if (r) {
			if (n || t >= r.fromS - .1 && t < r.toS) return;
			r.controller.abort(), this._pending = void 0;
		}
		if (e.updating) return;
		if (!n) {
			let e = this._next, n = this._runStartS;
			e && n !== void 0 && t >= e.atS - .5 && t < e.atS + .5 ? this._fetch({ first: e.index }, hn, !1) : this._fetch({ at: t * 1e3 }, hn, !1);
			return;
		}
		if (this._trim(t, n)) return;
		if (this._endS !== void 0 && n.end >= this._endS - .5) {
			this._endOfStream();
			return;
		}
		if (this._source?.streaming === !1 || n.end - t >= Cn(this._video.playbackRate, this._bytesPerSecond)) return;
		let i = this._next, a = i && Math.abs(i.atS - n.end) < .5 ? { first: i.index } : { at: n.end * 1e3 }, o = Math.min(gn * Math.max(1, this._video.playbackRate), _n);
		this._fetch(a, o, !1);
	};
	async _fetch(e, t, n) {
		let r = new AbortController(), i = e.at === void 0 ? this._next?.atS ?? 0 : e.at / 1e3;
		this._pending = {
			controller: r,
			fromS: i,
			toS: i + t / 1e3
		}, this.stats.fetching = !0;
		let a = performance.now(), o = e.first === void 0 ? `at=${Math.round(e.at ?? 0)}` : `first=${e.first}`;
		try {
			let n = await this._get(`frags?${o}&ms=${Math.round(t)}&bytes=${vn}`, r.signal), i = new Uint8Array(await n.arrayBuffer());
			if (this._closed || r.signal.aborted) return;
			let s = (e) => Number(n.headers.get(`X-RV-${e}`)), [c, l, u, d] = [
				s("First"),
				s("Count"),
				s("Start"),
				s("End")
			];
			if (this.stats.windows += 1, this.stats.bytes += i.length, this.stats.lastWaitMs = performance.now() - a, l > 0 && (await this._append(i), (e.first === void 0 || this._runStartS === void 0) && (this._runStartS = u / 1e3), this._next = {
				index: c + l,
				atS: d / 1e3
			}, d > u && (this._bytesPerSecond = i.length * 1e3 / (d - u))), n.headers.get("X-RV-Last") === "1") {
				let t = e.first === void 0 ? void 0 : this._next?.atS;
				this._endS = l > 0 ? d / 1e3 : t ?? this._video.duration, this._endOfStream();
			}
			if (l === 0) {
				this._settle(r), setTimeout(this._pump, bn);
				return;
			}
		} catch (e) {
			if (this._closed || r.signal.aborted) return;
			if (n) throw e;
			this._closed = !0, this._onError(e instanceof Error ? e : Error(String(e)));
			return;
		} finally {
			this._settle(r);
		}
		this._pump();
	}
	async _append(e) {
		let t = this._buffer;
		if (t) {
			await this._idle(t);
			try {
				t.appendBuffer(e);
			} catch (n) {
				if (!wn(n)) throw n;
				await this._removeAllBut(t, 2), t.appendBuffer(e);
			}
			await this._idle(t);
		}
	}
	_idle(e) {
		return e.updating ? new Promise((t, n) => {
			let r = () => {
				e.removeEventListener("error", i), t();
			}, i = () => {
				e.removeEventListener("updateend", r), n(new mn("append error"));
			};
			e.addEventListener("updateend", r, { once: !0 }), e.addEventListener("error", i, { once: !0 });
		}) : Promise.resolve();
	}
	async _removeAllBut(e, t) {
		let n = this._video.currentTime;
		for (let r of Sn(e.buffered)) {
			let i = Math.max(r.start, n - t), a = Math.min(r.end, n + t);
			a <= i ? (this._remove(e, r.start, r.end), await this._idle(e)) : (i > r.start && (this._remove(e, r.start, i), await this._idle(e)), r.end > a && (this._remove(e, a, r.end), await this._idle(e)));
		}
		this.stats.trims += 1;
	}
	_trim(e, t) {
		let n = this._buffer;
		if (!n) return !1;
		for (let r of Sn(n.buffered)) if (r.start !== t.start && (r.end < e - 30 || r.start > e + 240)) return this._remove(n, r.start, r.end), this.stats.trims += 1, !0;
		return e - t.start > 40 && (this._remove(n, t.start, e - 30), this.stats.trims += 1, !0);
	}
	_remove(e, t, n) {
		e.remove(t, n);
		let r = this._runStartS, i = this._next;
		r === void 0 || !i || n <= r || t >= i.atS || (this._runStartS = n >= i.atS - .5 ? void 0 : n);
	}
	_endOfStream() {
		let e = this._source, t = this._buffer;
		if (e && t && e.readyState === "open") {
			if (t.updating) t.addEventListener("updateend", () => {
				this._endOfStream();
			}, { once: !0 });
			else try {
				e.endOfStream();
			} catch {}
		}
	}
	_rangeAt(e) {
		let t = this._buffer;
		if (t) return Sn(t.buffered).find((t) => e >= t.start - .05 && e < t.end);
	}
	_jumpGap = () => {
		let e = this._buffer;
		if (this._closed || !e) return;
		let t = this._video.currentTime, n = e.buffered;
		for (let e = 0; e < n.length; e += 1) {
			let r = n.start(e);
			if (r > t && r - t < .5) {
				this._video.currentTime = r + .001;
				return;
			}
		}
	};
}, En = 10, Dn = 2, On = .5, kn = 1e4;
function An(e) {
	return new Promise((t) => {
		let n = !1, r = () => {
			n || (n = !0, t(performance.now()));
		};
		typeof e.requestVideoFrameCallback == "function" ? e.requestVideoFrameCallback(() => {
			r();
		}) : e.addEventListener("playing", r, { once: !0 });
	});
}
var jn = class {
	video;
	done;
	onEnd;
	t0 = performance.now();
	steps = {};
	closed = !1;
	_resolve;
	_timer;
	_playing = !1;
	_ended = !1;
	_lastFrame = 0;
	_stallTimer;
	constructor(e, t) {
		this.video = e, this.done = new Promise((e) => {
			this._resolve = e;
		}), this._timer = setTimeout(() => {
			this.fail(`no frame within ${Math.round(t / 1e3)} s`);
		}, t), e.muted = !0, e.playsInline = !0, e.autoplay = !0, An(e).then(async (t) => {
			if (this.closed) return;
			clearTimeout(this._timer), this._playing = !0, this._watchFrames();
			let n = await this.describe().catch(() => ({}));
			this._resolve({
				ok: !0,
				firstFrameMs: t - this.t0,
				steps: this.steps,
				...e.videoWidth ? {
					width: e.videoWidth,
					height: e.videoHeight
				} : {},
				...n
			});
		}, () => void 0);
	}
	step(e) {
		this.steps[e] ??= Math.round(performance.now() - this.t0);
	}
	fail(e) {
		if (clearTimeout(this._timer), this._playing) {
			if (this._ended || this.closed) return;
			this._ended = !0, clearInterval(this._stallTimer), this.onEnd?.(e);
		} else this.describe().catch(() => ({})).then((t) => {
			this._resolve({
				ok: !1,
				error: e,
				steps: this.steps,
				...t
			});
		});
	}
	describe() {
		return Promise.resolve({});
	}
	play() {
		this.video.play().catch(() => void 0);
	}
	_watchFrames() {
		let e = this.video;
		this._lastFrame = performance.now();
		let t = () => {
			this._lastFrame = performance.now();
		};
		if (typeof e.requestVideoFrameCallback == "function") {
			let n = () => {
				t(), !this.closed && !this._ended && e.requestVideoFrameCallback(n);
			};
			e.requestVideoFrameCallback(n);
		} else e.addEventListener("timeupdate", t);
		this._stallTimer = setInterval(() => {
			performance.now() - this._lastFrame > 1e4 && this.fail(`no new frame for ${Math.round(kn / 1e3)} s`);
		}, 1e3);
	}
	close() {
		this.closed = !0, clearTimeout(this._timer), clearInterval(this._stallTimer);
		let e = this.video;
		e.pause(), e.srcObject = null, e.removeAttribute("src"), e.load();
	}
}, Mn = class extends jn {
	pc;
	async connect(e) {
		let t = new RTCPeerConnection({ iceServers: e });
		this.pc = t, t.addTransceiver("video", { direction: "recvonly" }), t.addTransceiver("audio", { direction: "recvonly" }), t.addEventListener("track", (e) => {
			this.step("track"), this.video.srcObject || (this.video.srcObject = e.streams[0] ?? new MediaStream([e.track]), this.play());
		}), t.addEventListener("iceconnectionstatechange", () => {
			let e = t.iceConnectionState;
			(e === "connected" || e === "completed") && this.step("connected"), e === "failed" && this.fail("ICE failed: no path between the browser and the server");
		}), t.addEventListener("icegatheringstatechange", () => {
			t.iceGatheringState === "complete" && this.step("gathered");
		});
		let n = await t.createOffer();
		return await t.setLocalDescription(n), this.step("offer"), n;
	}
	async describe() {
		return this.pc ? { pair: Lt(await this.pc.getStats()) } : {};
	}
	close() {
		super.close(), this.pc?.close();
	}
}, Nn = class extends Mn {
	_hass;
	_unsubscribe;
	_session;
	_early = [];
	constructor(e, t, n, r, i) {
		super(t, i), this._hass = e, this._start(n, r);
	}
	async _start(e, t) {
		try {
			let n = await this.connect(t);
			this.pc?.addEventListener("icecandidate", (e) => {
				let t = e.candidate?.candidate;
				t && (this._session ? this._send(t) : this._early.push(t));
			}), this._unsubscribe = await pt(this._hass, e, n.sdp ?? "", (e) => {
				this._signal(e);
			}), this.closed && this._unsubscribe();
		} catch (e) {
			this.fail(N(e).message);
		}
	}
	async _send(e) {
		this._session && !this.closed && await mt(this._hass, this._session, e).catch(() => void 0);
	}
	async _signal(e) {
		let t = this.pc;
		if (t && !this.closed) try {
			switch (e.type) {
				case "session":
					this._session = e.session_id;
					for (let e of this._early.splice(0)) this._send(e);
					return;
				case "answer":
					this.step("answer"), await t.setRemoteDescription({
						type: "answer",
						sdp: e.sdp
					});
					return;
				case "candidate":
					e.candidate && await t.addIceCandidate({
						candidate: e.candidate,
						sdpMid: "0"
					});
					return;
				case "error":
					this.fail(e.message);
					return;
				case "closed":
					this.step("closed");
					return;
			}
		} catch (e) {
			this.fail(N(e).message);
		}
	}
	close() {
		super.close(), this._unsubscribe?.().catch(() => void 0);
	}
}, Pn = class extends Mn {
	_hass;
	_entityId;
	_unsubscribe;
	_session;
	_early = [];
	constructor(e, t, n, r) {
		super(t, r), this._hass = e, this._entityId = n, this._start();
	}
	async _start() {
		try {
			let e = await this._hass.callWS({
				type: "camera/webrtc/get_client_config",
				entity_id: this._entityId
			});
			this.step("config");
			let t = await this.connect(e.configuration.iceServers ?? []);
			this.pc?.addEventListener("icecandidate", (e) => {
				if (!e.candidate) return;
				let t = e.candidate.toJSON();
				this._session ? this._send(t) : this._early.push(t);
			}), this._unsubscribe = await this._hass.connection.subscribeMessage((e) => {
				this._signal(e);
			}, {
				type: "camera/webrtc/offer",
				entity_id: this._entityId,
				offer: t.sdp ?? ""
			}), this.closed && this._unsubscribe();
		} catch (e) {
			this.fail(N(e).message);
		}
	}
	async _send(e) {
		this._session && !this.closed && await this._hass.callWS({
			type: "camera/webrtc/candidate",
			entity_id: this._entityId,
			session_id: this._session,
			candidate: e
		}).catch(() => void 0);
	}
	async _signal(e) {
		let t = this.pc;
		if (t && !this.closed) try {
			switch (e.type) {
				case "session":
					this._session = e.session_id;
					for (let e of this._early.splice(0)) this._send(e);
					return;
				case "answer":
					this.step("answer"), await t.setRemoteDescription({
						type: "answer",
						sdp: e.answer
					});
					return;
				case "candidate":
					await t.addIceCandidate(e.candidate);
					return;
				case "error":
					this.fail(`${e.code}: ${e.message}`);
					return;
			}
		} catch (e) {
			this.fail(N(e).message);
		}
	}
	close() {
		super.close(), this._unsubscribe?.().catch(() => void 0);
	}
}, Fn = class extends jn {
	_hass;
	_base;
	_videoOnly;
	_ws;
	_buffer;
	_url;
	_queue = [];
	_api;
	_mime = "";
	_started = !1;
	constructor(e, t, n, r, i = location.href, a = !1) {
		super(t, r), this._hass = e, this._base = i, this._videoOnly = a, this._start(n);
	}
	async _start(e) {
		let t = G();
		if (!t) {
			this.fail("this browser has no MediaSource");
			return;
		}
		this._api = t;
		let n = window[t];
		try {
			let { path: t } = await at(this._hass, e);
			if (this.step("url"), this.closed) return;
			let r = new WebSocket(Ht(t, this._base));
			r.binaryType = "arraybuffer", this._ws = r, r.addEventListener("open", () => {
				this.step("open");
				let e = Nt((e) => n.isTypeSupported(e), this._videoOnly);
				r.send(JSON.stringify({
					type: "mse",
					value: e
				}));
			}), r.addEventListener("message", (e) => {
				typeof e.data == "string" ? this._text(e.data, n) : this._media(e.data);
			}), r.addEventListener("close", () => {
				this.closed || this.fail("the server closed the stream");
			});
		} catch (e) {
			this.fail(N(e).message);
		}
	}
	_text(e, t) {
		let n;
		try {
			n = JSON.parse(e);
		} catch {
			return;
		}
		if (n.type === "error") {
			this.fail(n.value ?? "error");
			return;
		}
		if (n.type !== "mse" || !n.value) return;
		this.step("mime"), this._mime = n.value;
		let r = new t();
		this.video.disableRemotePlayback = !0, this._url = URL.createObjectURL(r), r.addEventListener("sourceopen", () => {
			try {
				this._buffer = r.addSourceBuffer(n.value ?? ""), this._buffer.mode = "segments", this._buffer.addEventListener("updateend", () => {
					this._appended();
				}), this._next();
			} catch (e) {
				this.fail(`MSE refused ${n.value ?? ""}: ${N(e).message}`);
			}
		}, { once: !0 }), this.video.src = this._url;
	}
	_media(e) {
		this.step("first data"), this._queue.push(e), this._next();
	}
	_next() {
		let e = this._buffer;
		if (!e || e.updating || this.closed) return;
		let t = this._queue.shift();
		if (t) try {
			e.appendBuffer(t);
		} catch (e) {
			this.fail(`append failed: ${N(e).message}`);
		}
	}
	_appended() {
		let e = this._buffer, t = this.video;
		if (!e || this.closed) return;
		let n = e.buffered;
		if (n.length) {
			let r = n.start(0), i = n.end(n.length - 1);
			if (!this._started && i > r ? (this._started = !0, this.step("appended"), t.currentTime = Math.max(r, i - On), this.play()) : i - t.currentTime > Dn && (t.currentTime = i - .3), t.currentTime - r > 20 && !e.updating) {
				e.remove(r, t.currentTime - En);
				return;
			}
		}
		this._next();
	}
	describe() {
		return Promise.resolve(this._api ? { mse: {
			api: this._api,
			mime: this._mime
		} } : {});
	}
	close() {
		this._ws?.close(), super.close(), this._url && URL.revokeObjectURL(this._url);
	}
}, In = {
	WebRTC: 15e3,
	MSE: 12e3
}, Ln = [
	1,
	2,
	5,
	10,
	30
], Rn = (e, t, n, r, i, a) => e === "MSE" ? new Fn(t, n, r, a) : new Nn(t, n, r, i, a), zn = class {
	_hass;
	_video;
	ref;
	options;
	_onState;
	_factory;
	state = { kind: "idle" };
	events = [];
	onCount = () => void 0;
	_session;
	_timer;
	_failures = 0;
	_run = 0;
	constructor(e, t, n, r, i = () => void 0, a = Rn) {
		this._hass = e, this._video = t, this.ref = n, this.options = r, this._onState = i, this._factory = a;
	}
	get running() {
		return this.state.kind !== "idle";
	}
	start() {
		this.running || (this._failures = 0, this._attempt(this._run));
	}
	retryNow() {
		this.state.kind === "waiting" && (clearTimeout(this._timer), this._attempt(this._run));
	}
	stop() {
		this._run += 1, clearTimeout(this._timer), this._session?.close(), this._session = void 0, this.state.kind !== "idle" && this._note("stopped"), this._set({ kind: "idle" });
	}
	async _attempt(e) {
		let t = this.options.warm ? ["MSE", "WebRTC"] : ["WebRTC", "MSE"], n = "failed";
		for (let r of t) {
			this._note(`${r}: starting`), this._set({
				kind: "starting",
				transport: r
			});
			let t = this._factory(r, this._hass, this._video, this.ref, this.options.iceServers, In[r]);
			this._session = t;
			let i = Date.now();
			t.onEnd = (n) => {
				this._ended(e, t, i, n);
			};
			let a = await t.done;
			if (e !== this._run || this._session !== t) return;
			if (a.ok) {
				let e = a.firstFrameMs;
				this._note(`${r}: playing${e === void 0 ? "" : `, first frame in ${(e / 1e3).toFixed(2)} s`}`), this.onCount("plays"), this._set({
					kind: "playing",
					transport: r,
					result: a
				});
				return;
			}
			t.close(), this._session = void 0, n = `${r}: ${a.error ?? "failed"}`, this._note(n), this.onCount("failures");
		}
		this._failures += 1, this._wait(e, n);
	}
	_ended(e, t, n, r) {
		e === this._run && this._session === t && (t.close(), this._session = void 0, this._note(`ended after ${Math.round((Date.now() - n) / 1e3)} s: ${r}`), this.onCount("drops"), Date.now() - n >= 3e4 ? (this._failures = 0, this._attempt(e)) : (this._failures += 1, this._wait(e, r)));
	}
	_wait(e, t) {
		let n = Ln[Math.min(this._failures, Ln.length) - 1] ?? Ln[0];
		this._note(`next try in ${n} s`), this._set({
			kind: "waiting",
			error: t,
			retryAt: Date.now() + n * 1e3
		}), this._timer = setTimeout(() => {
			e === this._run && this._attempt(e);
		}, n * 1e3);
	}
	_note(e) {
		this.events.push({
			at: Date.now(),
			text: e
		}), this.events.length > 20 && this.events.splice(0, this.events.length - 20);
	}
	_set(e) {
		this.state = e, this._onState(e);
	}
}, Bn = /* @__PURE__ */ new Map();
function Vn(e, t) {
	let n = `${e ?? ""}|${JSON.stringify(t)}`, r = Bn.get(n);
	if (!r) {
		try {
			r = new Intl.DateTimeFormat(void 0, {
				...t,
				...e ? { timeZone: e } : {}
			});
		} catch {
			r = new Intl.DateTimeFormat(void 0, t);
		}
		Bn.set(n, r);
	}
	return r;
}
function Hn(e, t) {
	return Vn(t, {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23"
	}).format(e);
}
function K(e, t, n = !1) {
	return Vn(t, {
		hour: "2-digit",
		minute: "2-digit",
		...n ? { second: "2-digit" } : {},
		hourCycle: "h23"
	}).format(e);
}
function Un(e, t) {
	let n = Vn(t, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).formatToParts(e), r = (e) => n.find((t) => t.type === e)?.value ?? "";
	return `${r("year")}-${r("month")}-${r("day")}`;
}
function Wn(e, t) {
	let n = Vn(t, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23"
	}).formatToParts(e), r = (e) => Number(n.find((t) => t.type === e)?.value ?? 0);
	return Date.UTC(r("year"), r("month") - 1, r("day"), r("hour"), r("minute"), r("second")) - Math.floor(e / 1e3) * 1e3;
}
function Gn(e) {
	try {
		let t = new Intl.Locale(e ?? navigator.language), n = t.getWeekInfo?.() ?? t.weekInfo;
		if (n) return n.firstDay % 7;
	} catch {}
	return +!/^en-(US|CA)|^ja|^he/.test(e ?? navigator.language);
}
//#endregion
//#region src/components/live-controls.ts
var Kn = 5e3, qn = [
	"left_up",
	"up",
	"right_up",
	"left",
	null,
	"right",
	"left_down",
	"down",
	"right_down"
], Jn = {
	left: 0,
	left_up: 45,
	up: 90,
	right_up: 135,
	right: 180,
	right_down: 225,
	down: 270,
	left_down: 315
}, Yn = {
	left: "Move left",
	right: "Move right",
	up: "Move up",
	down: "Move down",
	left_up: "Move left and up",
	left_down: "Move left and down",
	right_up: "Move right and up",
	right_down: "Move right and down",
	zoom_in: "Zoom in",
	zoom_out: "Zoom out"
}, Xn = class extends M {
	static properties = {
		hass: { attribute: !1 },
		controls: { attribute: !1 },
		cameraName: { attribute: !1 },
		_moving: { state: !0 },
		_confirmSiren: { state: !0 },
		_error: { state: !0 }
	};
	_movement;
	_errorTimer;
	constructor() {
		super(), this.cameraName = "Camera", this._confirmSiren = !1;
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this.release(), clearTimeout(this._errorTimer);
	}
	press(e) {
		let t = this.controls?.ptz?.[e];
		!this._moving && t && this._usable(t) && (this._moving = e, this._movement = this._call("button", "press", t, Yn[e].toLowerCase()));
	}
	release() {
		if (!this._moving) return;
		this._moving = void 0;
		let e = this.controls?.ptz?.stop, t = this._movement ?? Promise.resolve();
		this._movement = void 0, e && t.finally(() => this._call("button", "press", e, "stop moving"));
	}
	_state(e) {
		return e ? this.hass?.states[e] : void 0;
	}
	_usable(e) {
		let t = this._state(e)?.state;
		return t !== void 0 && t !== "unavailable";
	}
	async _call(e, t, n, r, i = {}) {
		try {
			await this.hass?.callService(e, t, i, { entity_id: n }, !1);
		} catch (e) {
			this._showError(`Could not ${r}: ${N(e).message}`);
		}
	}
	_showError(e) {
		this._error = e, clearTimeout(this._errorTimer), this._errorTimer = setTimeout(() => {
			this._error = void 0;
		}, Kn);
	}
	_step(e, t, n) {
		let r = this._state(e), i = Number(r?.state);
		if (!r || !Number.isFinite(i)) return;
		let a = r.attributes, o = a.min ?? 0, s = a.max ?? 100, c = Math.max(a.step ?? 1, Math.round((s - o) / 10)), l = Math.min(s, Math.max(o, i + t * c));
		l !== i && this._call("number", "set_value", e, n, { value: l });
	}
	render() {
		let e = this.controls ?? {};
		return O`${this._renderTop(e)} ${this._renderPad(e)} ${this._renderZoom(e)}
    ${this._confirmSiren ? this._renderConfirm() : A}
    ${this._error ? O`<div class="error" role="alert">${this._error}</div>` : A}`;
	}
	_renderTop(e) {
		let { preset: t, floodlight: n, siren: r } = e;
		if (!t && !n && !r) return A;
		let i = this._state(t)?.attributes?.options ?? [], a = this._state(n)?.state === "on", o = this._state(r)?.state === "on";
		return O`<div class="top">
      ${t && i.length ? O`<select
            aria-label="Go to a preset"
            ?disabled=${!this._usable(t)}
            @change=${(e) => {
			let n = e.target, r = n.value;
			n.value = "", r && this._call("select", "select_option", t, "go to the preset", { option: r });
		}}
          >
            <option value="">Preset…</option>
            ${i.map((e) => O`<option value=${e}>${e}</option>`)}
          </select>` : A}
      ${n ? O`<button
            class="toggle ${a ? "on" : ""}"
            aria-pressed=${a ? "true" : "false"}
            ?disabled=${!this._usable(n)}
            @click=${() => {
			this._call("light", a ? "turn_off" : "turn_on", n, "switch the floodlight");
		}}
          >
            Light
          </button>` : A}
      ${r ? O`<button
            class="toggle siren ${o ? "on" : ""}"
            aria-pressed=${o ? "true" : "false"}
            ?disabled=${!this._usable(r)}
            @click=${() => {
			o ? this._call("siren", "turn_off", r, "stop the siren") : this._confirmSiren = !0;
		}}
          >
            ${o ? "Stop siren" : "Siren"}
          </button>` : A}
    </div>`;
	}
	_renderConfirm() {
		let e = this.controls?.siren;
		return O`<div class="confirm" role="alertdialog" aria-labelledby="siren-title">
      <strong id="siren-title">Sound the siren on ${this.cameraName}?</strong>
      <span class="small">It is loud, and keeps sounding until you stop it.</span>
      <span class="actions">
        <button
          @click=${() => {
			this._confirmSiren = !1;
		}}
        >
          Cancel
        </button>
        <button
          class="danger"
          @click=${() => {
			this._confirmSiren = !1, e && this._call("siren", "turn_on", e, "sound the siren");
		}}
        >
          Sound it
        </button>
      </span>
    </div>`;
	}
	_renderPad(e) {
		let t = e.ptz;
		return t?.stop ? O`<div class="pad" role="group" aria-label="Move the camera">
      ${qn.map((e) => e && t[e] ? this._holdButton(e, O`<svg viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(${Jn[e] ?? 0}deg)">
              ${k`<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`}
            </svg>`) : O`<span></span>`)}
    </div>` : A;
	}
	_renderZoom(e) {
		let t = e.ptz, n = t?.stop && t.zoom_in && t.zoom_out, r = n ? void 0 : e.zoom, i = e.focus;
		if (!n && !r && !i) return A;
		let a = (e, t, n) => O`<span class="stepper" role="group" aria-label=${n}>
        <button
          aria-label=${`${n} out`}
          ?disabled=${!this._usable(e)}
          @click=${() => {
			this._step(e, -1, t);
		}}
        >
          ${P("minus")}
        </button>
        <span class="small">${n}</span>
        <button
          aria-label=${`${n} in`}
          ?disabled=${!this._usable(e)}
          @click=${() => {
			this._step(e, 1, t);
		}}
        >
          ${P("plus")}
        </button>
      </span>`;
		return O`<div class="zoom">
      ${i ? a(i, "focus", "Focus") : A}
      ${n ? O`<span class="stepper" role="group" aria-label="Zoom">
            ${this._holdButton("zoom_out", P("minus"))}<span class="small">Zoom</span>${this._holdButton("zoom_in", P("plus"))}
          </span>` : r ? a(r, "zoom", "Zoom") : A}
    </div>`;
	}
	_holdButton(e, t) {
		let n = this.controls?.ptz?.[e];
		return O`<button
      class="hold ${this._moving === e ? "held" : ""}"
      aria-label=${Yn[e]}
      ?disabled=${!this._usable(n)}
      @pointerdown=${(t) => {
			t.preventDefault();
			try {
				t.currentTarget.setPointerCapture(t.pointerId);
			} catch {}
			this.press(e);
		}}
      @pointerup=${() => {
			this.release();
		}}
      @pointercancel=${() => {
			this.release();
		}}
      @lostpointercapture=${() => {
			this.release();
		}}
      @keydown=${(t) => {
			(t.key === "Enter" || t.key === " ") && !t.repeat && (t.preventDefault(), this.press(e));
		}}
      @keyup=${(e) => {
			(e.key === "Enter" || e.key === " ") && this.release();
		}}
      @blur=${() => {
			this.release();
		}}
      @contextmenu=${(e) => {
			e.preventDefault();
		}}
    >
      ${t}
    </button>`;
	}
	static styles = [F, o`
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
        color: var(--rv-on-board);
      }
      .top,
      .pad,
      .zoom,
      .confirm,
      .error {
        position: absolute;
        pointer-events: auto;
      }
      /* Square controls in the board's ink over the video. */
      button,
      select {
        border: none;
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.72);
        color: var(--rv-on-board);
        min-height: 32px;
      }
      button:disabled {
        opacity: 0.4;
      }
      .top {
        top: 8px;
        right: 36px;
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .top select {
        padding: 4px 8px;
        max-width: 140px;
      }
      .toggle {
        padding: 4px 12px;
      }
      .toggle.on {
        background: var(--rv-on-board);
        color: var(--rv-board);
      }
      .toggle.siren.on {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .pad {
        left: 8px;
        bottom: 28px;
        display: grid;
        grid-template-columns: repeat(3, 32px);
        grid-template-rows: repeat(3, 32px);
        gap: 2px;
      }
      .hold {
        width: 32px;
        height: 32px;
        padding: 4px;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }
      .hold.held {
        background: var(--rv-on-board);
        color: var(--rv-board);
      }
      .hold svg {
        display: block;
        width: 24px;
        height: 24px;
      }
      .zoom {
        right: 48px;
        bottom: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: flex-end;
      }
      .stepper {
        display: flex;
        gap: 4px;
        align-items: center;
        text-shadow: 0 0 3px #000;
      }
      .stepper button {
        width: 32px;
        padding: 0;
        font-size: 18px;
      }
      .confirm {
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: min(320px, 90%);
        padding: 12px 16px;
        border-top: 2px solid var(--rv-fault);
        background: var(--rv-board);
      }
      .confirm .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .confirm button {
        padding: 4px 12px;
      }
      .confirm button.danger {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .error {
        left: 50%;
        top: 44px;
        transform: translateX(-50%);
        max-width: 90%;
        padding: 6px 12px;
        font-size: 13px;
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
    `];
};
customElements.get("rv-live-controls") || customElements.define("rv-live-controls", Xn);
//#endregion
//#region src/clipboard.ts
async function Zn(e) {
	let t = navigator.clipboard;
	try {
		if (window.isSecureContext && t) return await t.writeText(e), !0;
	} catch {}
	let n = document.createElement("textarea");
	n.value = e, n.setAttribute("readonly", ""), n.style.cssText = `position:absolute;left:-9999px;top:${window.scrollY}px;font-size:12pt;border:0;padding:0;margin:0`, document.body.append(n), n.select(), n.setSelectionRange(0, e.length);
	try {
		return document.execCommand("copy");
	} catch {
		return !1;
	} finally {
		n.remove();
	}
}
//#endregion
//#region src/live/debug.ts
var Qn = (e) => `${(e / 1e3).toFixed(e < 1e4 ? 2 : 0)} s`;
function $n(e, t, n = Date.now()) {
	let r = e.connection, i = [`${e.camera}${r ? ` · ${r.via === "nvr" ? "through the NVR" : "direct"} (${r.entry_title})${r.is_battery ? " · on battery" : ""}` : ""}`];
	for (let r of e.players) {
		if (i.push(`${r.label} (${r.stream}, ${r.warm ? "kept warm" : "cold"}): ${er(r.state, n)}`), r.state.kind === "playing") {
			let e = r.state.result.pair;
			e?.local && i.push(`  path: ${e.local} ↔ ${e.remote ?? "?"}${e.rttMs === void 0 ? "" : `, rtt ${e.rttMs} ms`}`);
		}
		i.push(`  server: ${tr(t[r.label])}`);
	}
	e.hd && i.push(`HD choice: ${e.hd}`);
	for (let t of e.players) if (t.events.length) {
		i.push(`Events (${t.label}):`);
		for (let e of t.events) i.push(`  ${nr(e.at)} ${e.text}`);
	}
	return i.join("\n");
}
function er(e, t) {
	switch (e.kind) {
		case "idle": return "stopped";
		case "starting": return `starting over ${e.transport}`;
		case "waiting": return `${e.error}; next try in ${Qn(Math.max(0, e.retryAt - t))}`;
		case "playing": {
			let t = e.result, n = t.width ?? t.pair?.width, r = t.height ?? t.pair?.height, i = t.pair?.codec ?? /codecs="?([^"]+)/.exec(t.mse?.mime ?? "")?.[1];
			return [
				`playing over ${e.transport}`,
				t.firstFrameMs === void 0 ? void 0 : `first frame in ${Qn(t.firstFrameMs)}`,
				n && r ? `${n}×${r}` : void 0,
				i
			].filter((e) => e !== void 0).join(" · ");
		}
	}
}
function tr(e) {
	if (e === void 0) return "…";
	if (typeof e == "string") return `cannot read: ${e}`;
	let t = [e.state ? `go2rtc ${e.state.active ? "streaming" : "idle"}, ${e.state.consumers} consumer${e.state.consumers === 1 ? "" : "s"}` : "not in go2rtc", `held ${e.holds}×`], n = e.cache;
	return n ? (t.push(`${n.warm ? "warm feed" : "feed"} ${Qn(n.age_ms)} old, ${n.viewers} viewer${n.viewers === 1 ? "" : "s"}`), n.key_frame_age_ms !== null && t.push(`key frame ${Qn(n.key_frame_age_ms)} ago${n.key_interval_ms === null ? "" : `, every ${Qn(n.key_interval_ms)}`}`), n.parameter_sets && t.push(`parameter sets ${n.parameter_sets}`), n.ends && t.push(`${n.ends} feed${n.ends === 1 ? "" : "s"} dropped (last: ${n.last_end ?? "?"})`)) : t.push("no MSE feed"), t.join(", ");
}
function nr(e) {
	return new Date(e).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	});
}
//#endregion
//#region src/components/live-debug.ts
var rr = 2e3, ir = "rv-live-debug-close", ar = class extends M {
	static properties = {
		hass: { attribute: !1 },
		info: { attribute: !1 },
		_states: { state: !0 },
		_copied: { state: !0 }
	};
	_timer;
	constructor() {
		super(), this._states = {};
	}
	connectedCallback() {
		super.connectedCallback(), this._poll(), this._timer = setInterval(() => {
			this._poll();
		}, rr);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._timer);
	}
	async _poll() {
		let e = this.hass, t = this.info, n = t?.connection;
		if (!e || !t || !n) return;
		let r = async (t) => {
			try {
				return await st(e, {
					connectionId: n.connection_id,
					stream: t
				});
			} catch (e) {
				return N(e).message;
			}
		}, i = await Promise.all(t.players.map(async (e) => [e.label, await r(e.stream)]));
		this._states = Object.fromEntries(i);
	}
	render() {
		let e = this.info, t = e ? $n(e, this._states) : "";
		return O`<div class="panel" role="dialog" aria-label=${`${e?.camera ?? "Camera"}: debug`}>
      <pre>${t}</pre>
      <div class="actions">
        <button
          @click=${() => {
			Zn(t).then((e) => {
				this._copied = e;
			});
		}}
        >
          ${this._copied === void 0 ? "Copy" : this._copied ? "Copied" : "Could not copy"}
        </button>
        <button
          @click=${() => {
			this.dispatchEvent(new CustomEvent(ir, {
				bubbles: !0,
				composed: !0
			}));
		}}
        >
          Close
        </button>
      </div>
    </div>`;
	}
	static styles = [F, o`
      :host {
        position: absolute;
        inset: 0;
        color: #fff;
      }
      .panel {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: rgba(0, 0, 0, 0.85);
        border-radius: inherit;
      }
      pre {
        flex: 1;
        margin: 0;
        padding: 8px;
        overflow: auto;
        font-size: 11px;
        line-height: 1.4;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        padding: 6px 8px;
      }
      .actions button {
        padding: 4px 12px;
      }
    `];
};
customElements.get("rv-live-debug") || customElements.define("rv-live-debug", ar);
//#endregion
//#region src/components/live-tile.ts
var or = 3e3, sr = "rv-live-open", cr = "rv-live-full", lr = "rv-live-count", ur = "rv-live-state", dr = class extends M {
	static properties = {
		hass: { attribute: !1 },
		camera: { attribute: !1 },
		connection: { attribute: !1 },
		stream: { attribute: !1 },
		image: { attribute: !1 },
		iceServers: { attribute: !1 },
		warm: { attribute: !1 },
		openable: { type: Boolean },
		fill: {
			type: Boolean,
			reflect: !0
		},
		fit: { reflect: !0 },
		number: { attribute: !1 },
		suspended: { attribute: !1 },
		controls: { attribute: !1 },
		_state: { state: !0 },
		_onScreen: { state: !0 },
		_pageVisible: { state: !0 },
		_wanted: { state: !0 },
		_full: { state: !0 },
		_hd: { state: !0 },
		_hdState: { state: !0 },
		_debug: { state: !0 }
	};
	_player;
	_hdPlayer;
	_hdChoosing;
	_native = !1;
	_observer;
	_offscreenTimer;
	constructor() {
		super(), this.stream = "sub", this.openable = !1, this.fill = !1, this.fit = "cover", this.suspended = !1, this._state = { kind: "idle" }, this._hdState = { kind: "idle" }, this._onScreen = typeof IntersectionObserver > "u", this._pageVisible = document.visibilityState !== "hidden", this._wanted = !0, this._full = !1, this._debug = !1;
	}
	connectedCallback() {
		super.connectedCallback(), document.addEventListener("visibilitychange", this._onVisibility), document.addEventListener("fullscreenchange", this._onFullscreenChange), document.addEventListener("keydown", this._onKeydown), typeof IntersectionObserver < "u" && (this._observer = new IntersectionObserver((e) => {
			this._onScreen = e.some((e) => e.isIntersecting);
		}, { rootMargin: "100px" }), this._observer.observe(this)), this.requestUpdate();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), document.removeEventListener("fullscreenchange", this._onFullscreenChange), document.removeEventListener("keydown", this._onKeydown), this._observer?.disconnect(), this._observer = void 0, clearTimeout(this._offscreenTimer), this._player?.stop(), this._hdPlayer?.stop(), this.exitFull();
	}
	_onVisibility = () => {
		this._pageVisible = document.visibilityState !== "hidden";
	};
	_count = (e) => {
		this.dispatchEvent(new CustomEvent(lr, {
			detail: {
				camera: this.camera?.name ?? "Camera",
				kind: e
			},
			bubbles: !0
		}));
	};
	_onFullscreenChange = () => {
		this._native && !document.fullscreenElement && (this._native = !1, this.exitFull());
	};
	_onKeydown = (e) => {
		e.key === "Escape" && this._full && !this._native && this.exitFull();
	};
	get shouldPlay() {
		return this.isConnected && this._wanted && !this.suspended && this._pageVisible && this._onScreen && this.connection?.streams[this.stream] !== void 0;
	}
	get waitsForTap() {
		return this.connection?.is_battery === !0 || this.camera?.records === !1;
	}
	get hdShown() {
		return this._full && this._hdState.kind === "playing";
	}
	get full() {
		return this._full;
	}
	enterFull() {
		this._full || (this._full = !0, this._wanted = !0, document.fullscreenEnabled && typeof this.requestFullscreen == "function" && this.requestFullscreen().then(() => {
			this._native = !0, this._full || document.exitFullscreen().catch(() => void 0);
		}).catch(() => void 0), this._fullChanged());
	}
	exitFull() {
		this._full && (this._full = !1, this._native && document.fullscreenElement && document.exitFullscreen().catch(() => void 0), this._native = !1, this._fullChanged());
	}
	_fullChanged() {
		this.dispatchEvent(new CustomEvent(cr, {
			detail: {
				cameraId: this.camera?.id,
				full: this._full
			},
			bubbles: !0,
			composed: !0
		}));
	}
	willUpdate(e) {
		(e.has("connection") || e.has("stream")) && (this._player?.stop(), this._player = void 0, this._hdPlayer?.stop(), this._hdPlayer = void 0, this._hd = void 0, this._hdChoosing = void 0, this._wanted = this._full || !this.waitsForTap), this.toggleAttribute("full", this._full);
	}
	updated() {
		this._driveSub(), this._driveHd();
	}
	_driveSub() {
		let e = this._ensurePlayer();
		e && (e.options.warm = this.warm ?? this.connection?.streams[this.stream]?.warm === !0, this.shouldPlay && !this.hdShown ? (clearTimeout(this._offscreenTimer), this._offscreenTimer = void 0, this._start(e)) : e.running && (!this._pageVisible || !this._wanted || this.suspended || this.hdShown ? e.stop() : this._offscreenTimer ??= setTimeout(() => {
			this._offscreenTimer = void 0, this.shouldPlay || (this._player?.stop(), this._hdPlayer?.stop());
		}, or)));
	}
	_driveHd() {
		let e = this.connection, t = this._full && this.shouldPlay;
		t && e && !this._hd && this._hdChoosing !== e && (this._hdChoosing = e, pn(e).then((t) => {
			this.connection === e && (this._hd = t);
		}));
		let n = this._ensureHdPlayer();
		n && (t ? this._start(n) : n.running && (!this._full || !this._pageVisible || this.suspended || !this._wanted) && n.stop());
	}
	_start(e) {
		!e.running && (e.options.warm || this.iceServers) && (e.options.iceServers = this.iceServers ?? [], e.start());
	}
	_ensurePlayer() {
		if (this._player) return this._player;
		let e = this.renderRoot.querySelector("video.sub"), t = this.connection;
		if (this.hass && e && t) return this._player = new zn(this.hass, e, {
			connectionId: t.connection_id,
			stream: this.stream
		}, {
			warm: !1,
			iceServers: []
		}, (e) => {
			let t = e.kind === "playing";
			t !== (this._state.kind === "playing") && this.dispatchEvent(new CustomEvent(ur, {
				detail: {
					cameraId: this.camera?.id ?? "",
					live: t
				},
				bubbles: !0
			})), this._state = e;
		}), this._player.onCount = this._count, this._player;
	}
	_ensureHdPlayer() {
		if (this._hdPlayer) return this._hdPlayer;
		let e = this._hd?.stream, t = this.renderRoot.querySelector("video.hd"), n = this.connection;
		if (this.hass && e && t && n) return this._hdPlayer = new zn(this.hass, t, {
			connectionId: n.connection_id,
			stream: e
		}, {
			warm: n.streams[e]?.warm === !0,
			iceServers: []
		}, (e) => {
			this._hdState = e;
		}), this._hdPlayer.onCount = this._count, this._hdPlayer;
	}
	_activate() {
		this._full || (this._wanted ? this.openable && this.camera && this.dispatchEvent(new CustomEvent(sr, {
			detail: { cameraId: this.camera.id },
			bubbles: !0,
			composed: !0
		})) : this._wanted = !0);
	}
	render() {
		let e = this._state, t = e.kind === "playing", n = this.camera?.name ?? "Camera", r = !this._full && (this.openable || !this._wanted);
		return O`<div class="frame">
      <div
        class="tile ${t ? "playing" : ""} ${this.hdShown ? "hd-on" : ""}"
        role=${r ? "button" : A}
        tabindex=${r ? "0" : A}
        aria-label=${r ? this._wanted ? `Open ${n}` : `Watch ${n}` : A}
        @click=${() => {
			this._activate();
		}}
        @keydown=${(e) => {
			(e.key === "Enter" || e.key === " ") && (e.preventDefault(), this._activate());
		}}
      >
        ${this.image ? O`<img class="poster" src=${this.image.url} alt="" />` : A}
        <video class="sub" muted playsinline aria-label=${`${n} live`}></video>
        ${this._hd?.stream ? O`<video class="hd" muted playsinline aria-label=${`${n} live in HD`}></video>` : A}
        ${this.number !== void 0 && !this._full ? O`<span class="num" aria-hidden="true">${this.number}</span>` : A}
        <div class="label">
          <span class="name">${n}</span>
          ${this._wanted ? A : O`<span class="hint">
                ${this.connection?.is_battery ? "Tap to wake it and watch" : "Tap to watch live"}
              </span>`}
        </div>
        ${this.hdShown ? A : this._renderStatus(e)}
        ${this._renderHd()}
      </div>
      ${this._debug ? O`<rv-live-debug
            .hass=${this.hass}
            .info=${this._debugInfo(n)}
            @rv-live-debug-close=${() => {
			this._debug = !1;
		}}
          ></rv-live-debug>` : A}
      <button
        class="corner-button info"
        aria-label=${`${n} debug info`}
        aria-pressed=${this._debug ? "true" : "false"}
        title="What this tile plays, and how"
        @click=${() => {
			this._debug = !this._debug;
		}}
      >
        ${P("info")}
      </button>
      ${this.controls && (this._full || !this.openable) ? O`<rv-live-controls
            .hass=${this.hass}
            .controls=${this.controls}
            .cameraName=${n}
          ></rv-live-controls>` : A}
      <button
        class="corner-button full"
        aria-label=${this._full ? "Exit full screen" : `${n} full screen`}
        title=${this._full ? "Exit full screen" : "Full screen (HD)"}
        @click=${() => {
			this._full ? this.exitFull() : this.enterFull();
		}}
      >
        ${P(this._full ? "exitFull" : "enterFull")}
      </button>
    </div>`;
	}
	_debugInfo(e) {
		let t = [], n = (e, n, r, i) => {
			r && t.push({
				label: e,
				stream: n,
				warm: r.options.warm,
				state: i,
				events: [...r.events]
			});
		};
		return n("SD", this.stream, this._player, this._state), this._hd?.stream && n("HD", this._hd.stream, this._hdPlayer, this._hdState), {
			camera: e,
			connection: this.connection,
			players: t,
			hd: this._hd?.reason
		};
	}
	_renderHd() {
		if (!this._full) return A;
		let e = this._hd, t = this._hdState, n = "SD", r;
		return this.hdShown ? n = "HD" : r = e ? e.stream ? t.kind === "waiting" ? `HD cannot play: ${t.error}` : "HD starting…" : e.reason : "Choosing the HD stream…", O`<div class="hd-status" title=${e?.reason ?? A}>
      <span class="badge ${this.hdShown ? "accent" : ""}">${n}</span>
      ${r ? O`<span class="small">${r}</span>` : A}
    </div>`;
	}
	_renderStatus(e) {
		if (!this._wanted) {
			if (this.connection?.is_battery) return fr("Asleep");
			let e = this.image ? K(this.image.taken, this.hass?.config?.time_zone) : void 0;
			return fr(e ? `Picture ${e}` : "No picture yet", P("picture"));
		}
		if (!this.connection?.streams[this.stream]) return fr(`No ${this.stream} stream`);
		switch (e.kind) {
			case "playing": return fr("Live", O`<i class="dot"></i>`);
			case "starting": return fr("Starting");
			case "waiting": return O`${fr("Retrying")}
          <div class="status center" role="alert">
            <span class="small">Cannot play: ${e.error}</span>
            <button
              @click=${(e) => {
				e.stopPropagation(), this._player?.retryNow();
			}}
            >
              Retry now
            </button>
          </div>`;
			default: return A;
		}
	}
	static styles = [F, o`
      :host {
        display: block;
        container-type: inline-size;
      }
      /* On the board: fill the cell. */
      :host([fill]),
      :host([fill]) .frame,
      :host([fill]) .tile {
        height: 100%;
      }
      :host([fill]) .tile {
        aspect-ratio: auto;
      }
      :host([fill][fit="cover"]) .poster,
      :host([fill][fit="cover"]) video.sub {
        object-fit: cover;
      }
      /* Full screen: the browser's, or filling the window (the iPhone). */
      :host([full]) {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: #000;
        overscroll-behavior: contain;
      }
      .frame {
        position: relative;
      }
      :host([full]) .frame,
      :host([full]) .tile {
        height: 100%;
      }
      :host([full]) .tile {
        aspect-ratio: auto;
      }
      :host([full]) .poster,
      :host([full]) video {
        object-fit: contain;
      }
      .tile {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 2px;
        overflow: hidden;
        color: #f4f4f1;
      }
      .tile[role="button"] {
        cursor: pointer;
      }
      .tile:focus-visible {
        outline: 2px solid #f4f4f1;
        outline-offset: -2px;
      }
      .poster,
      video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      video {
        opacity: 0;
        transition: opacity 0.3s;
      }
      .playing video.sub {
        opacity: 1;
      }
      /* HD replaces the sub stream at once, on its first frame. */
      video.hd {
        transition: none;
        background: #000;
      }
      .hd-on video.hd {
        opacity: 1;
      }
      .num {
        position: absolute;
        top: 8px;
        left: 8px;
        min-width: 26px;
        height: 26px;
        padding: 0 5px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: #f4f4f1;
        color: #111418;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .state {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        background: rgba(17, 20, 24, 0.74);
        font-size: 13px;
        font-weight: 500;
        line-height: 18px;
        white-space: nowrap;
      }
      /* A camera's own view has its controls top right, and no number. */
      :host(:not([fill])) .state {
        left: 8px;
        right: auto;
      }
      /* Full screen says SD or HD, top left. */
      :host([full]) .state {
        display: none;
      }
      .state .dot {
        width: 7px;
        height: 7px;
        background: currentColor;
      }
      .state svg {
        width: 16px;
        height: 16px;
      }
      .label {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        padding: 26px 48px 8px 10px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0));
        pointer-events: none;
      }
      .name {
        font-size: 15px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hint {
        font-size: 13px;
        color: #c9cede;
      }
      .hd-status {
        position: absolute;
        top: 8px;
        left: 8px;
        display: flex;
        gap: 6px;
        align-items: center;
        max-width: calc(100% - 64px);
        text-shadow: 0 0 3px #000;
      }
      .hd-status .badge {
        color: #f4f4f1;
        border-color: rgba(244, 244, 241, 0.5);
      }
      .hd-status .badge.accent {
        border-color: var(--rv-action);
      }
      .corner-button {
        position: absolute;
        right: 6px;
        bottom: 6px;
        width: 34px;
        height: 34px;
        min-height: 0;
        padding: 6px;
        border: none;
        border-radius: 2px;
        background: rgba(17, 20, 24, 0.6);
        color: #f4f4f1;
      }
      .corner-button:hover:not(:disabled) {
        background: rgba(17, 20, 24, 0.85);
      }
      .corner-button:focus-visible {
        outline-color: #f4f4f1;
      }
      .corner-button.info {
        bottom: 44px;
        opacity: 0.85;
      }
      .corner-button.info[aria-pressed="true"] {
        background: var(--rv-action);
        color: var(--rv-on-action);
        opacity: 1;
      }
      .corner-button svg {
        width: 22px;
        height: 22px;
      }
      /* On the board, its buttons show on hover; a touch screen has full screen only. */
      @media (hover: hover) {
        :host([fill]:not([full])) .corner-button {
          opacity: 0;
          transition: opacity 0.15s;
        }
        :host([fill]:not([full])) .frame:hover .corner-button,
        :host([fill]:not([full])) .corner-button:focus-visible,
        :host([fill]:not([full])) .corner-button[aria-pressed="true"] {
          opacity: 1;
        }
      }
      @media (hover: none) {
        :host([fill]:not([full])) .corner-button.info {
          display: none;
        }
      }
      .status.center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-align: center;
        padding: 40px 12px 12px;
        background: rgba(17, 20, 24, 0.55);
      }
      .status.center button {
        color: #f4f4f1;
        border-color: #f4f4f1;
      }
      .status.center button:hover:not(:disabled) {
        background: rgba(244, 244, 241, 0.12);
      }
      @container (max-width: 260px) {
        .num {
          top: 6px;
          left: 6px;
          min-width: 22px;
          height: 22px;
          font-size: 14px;
        }
        .state {
          top: 6px;
          right: 6px;
          padding: 2px 6px;
          font-size: 12px;
        }
        .label {
          padding: 20px 44px 6px 8px;
        }
        .name {
          font-size: 13px;
        }
        .hint {
          font-size: 12px;
        }
        .corner-button.info {
          display: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        video {
          transition: none;
        }
      }
    `];
};
function fr(e, t) {
	return O`<span class="state">${t ?? A}${e}</span>`;
}
customElements.get("rv-live-tile") || customElements.define("rv-live-tile", dr);
//#endregion
//#region src/components/live-grid.ts
var pr = 8, mr = "rv-board", hr = class extends M {
	static properties = {
		hass: { attribute: !1 },
		_full: { state: !0 },
		_boardFull: { state: !0 },
		_width: { state: !0 },
		_live: { state: !0 }
	};
	_data = new Ut(this);
	_resize;
	_announced;
	constructor() {
		super(), this._boardFull = !1, this._width = 0, this._live = /* @__PURE__ */ new Set();
	}
	connectedCallback() {
		super.connectedCallback(), W.opened(() => this.hass, document.visibilityState !== "hidden"), document.addEventListener("visibilitychange", this._onVisibility), document.addEventListener("fullscreenchange", this._onFullscreen), typeof ResizeObserver < "u" && (this._resize = new ResizeObserver((e) => {
			let t = e.at(-1);
			t && Math.abs(t.contentRect.width - this._width) >= 1 && (this._width = t.contentRect.width);
		}), this._resize.observe(this)), this._flush();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), document.removeEventListener("fullscreenchange", this._onFullscreen), this._resize?.disconnect(), this._resize = void 0, W.closed(), this._flush();
	}
	_onFullscreen = () => {
		this._boardFull = document.fullscreenElement === this;
	};
	_toggleBoardFull() {
		document.fullscreenElement === this ? document.exitFullscreen().catch(() => void 0) : this.requestFullscreen().catch(() => void 0);
	}
	_onVisibility = () => {
		let e = document.visibilityState !== "hidden";
		W.visibility(e), e || this._flush();
	};
	_flush() {
		this.hass && W.flush(this.hass);
	}
	willUpdate() {
		this._data.hass = this.hass;
	}
	updated() {
		let e = this._data.cameras;
		if (e && e !== this._announced) {
			this._announced = e;
			let t = _r(e);
			this.dispatchEvent(new CustomEvent(mr, {
				detail: { cameras: t },
				bubbles: !0,
				composed: !0
			}));
		}
	}
	render() {
		let e = this._data, t = e.cameras, n = document.fullscreenEnabled && typeof this.requestFullscreen == "function";
		return O`<div class="head">
        <h1>Live</h1>
        ${t?.length ? O`<p class="count">${gr(t, this._live)}</p>` : A}
        ${n && t?.length ? O`<button class="text with-icon full" @click=${() => {
			this._toggleBoardFull();
		}}>
              ${P(this._boardFull ? "exitFull" : "enterFull")}${this._boardFull ? "Exit full screen" : "Full screen"}
            </button>` : A}
      </div>
      ${e.error ? O`<div class="banner error" role="alert">
            Could not load live view: ${e.error}
            <button
              @click=${() => {
			e.reload();
		}}
            >
              Retry
            </button>
          </div>` : A}
      ${t === void 0 ? e.error ? A : O`<p class="note">Loading…</p>` : t.length === 0 ? O`<p class="note">No camera can be watched live.</p>` : this._renderGrid(t)}`;
	}
	_renderGrid(e) {
		let t = this._data, n = vr(e), r = n.map((e) => br(z(e))), i = r.reduce((e, t) => e + (t ? 2 : 1), 0), a = this._width, o = Math.max(2, Math.min(a >= 1100 ? 5 : a >= 800 ? 4 : a >= 540 ? 3 : 2, i)), s = a ? (a - (o - 1) * pr) / o : 0, c = 9 / 16 * s;
		return O`<div
      class="grid"
      style=${`--cols: ${o}; --row: ${c ? `${c.toFixed(1)}px` : "auto"}`}
      @rv-live-open=${(e) => {
			I(this, {
				view: "device",
				id: e.detail.cameraId,
				tab: "live"
			});
		}}
      @rv-live-full=${(e) => {
			e.detail.full ? this._full = e.detail.cameraId : this._full === e.detail.cameraId && (this._full = void 0);
		}}
      @rv-live-count=${(e) => {
			W.count(e.detail.camera, e.detail.kind);
		}}
      @rv-live-state=${(e) => {
			let t = new Set(this._live);
			e.detail.live ? t.add(e.detail.cameraId) : t.delete(e.detail.cameraId), this._live = t;
		}}
    >
      ${n.map((e, n) => O`<rv-live-tile
            class=${r[n] ?? ""}
            fill
            .fit=${yr(z(e), r[n], s)}
            .number=${n + 1}
            .hass=${this.hass}
            .camera=${e}
            .connection=${z(e)}
            .image=${t.images[e.id]}
            .iceServers=${t.iceServers}
            .warm=${Wt(this.hass, e)}
            .suspended=${this._full !== void 0 && this._full !== e.id}
            .controls=${e.controls}
            openable
          ></rv-live-tile>`)}
    </div>`;
	}
	static styles = [F, o`
      :host {
        display: block;
        padding: 16px 24px 28px;
        color: var(--rv-on-board);
        background: var(--rv-board);
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 14px;
        margin-bottom: 12px;
      }
      h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      .count,
      .note {
        margin: 0;
        color: var(--rv-on-board-muted);
        font-size: 15px;
      }
      button.full {
        margin-left: auto;
        color: var(--rv-on-board);
      }
      button.full:focus-visible {
        outline-color: var(--rv-on-board);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
        grid-auto-rows: var(--row, auto);
        grid-auto-flow: dense;
        gap: ${pr}px;
      }
      rv-live-tile.tall {
        grid-row: span 2;
      }
      rv-live-tile.wide {
        grid-column: span 2;
      }
      @media (max-width: 600px) {
        :host {
          padding: 12px 12px 20px;
        }
      }
    `];
};
function gr(e, t) {
	let n = e.filter((e) => t.has(e.id)).length;
	return n ? `${String(n)} of ${String(e.length)} playing` : `${String(e.length)} ${e.length === 1 ? "camera" : "cameras"}`;
}
function _r(e) {
	return vr(e).map((e, t) => ({
		id: e.id,
		name: e.name,
		number: t + 1
	}));
}
function vr(e) {
	let t = e.filter((e) => br(z(e)) === "tall");
	return [...t, ...e.filter((e) => !t.includes(e))];
}
function yr(e, t, n) {
	let r = xr(e);
	if (!r) return "cover";
	let i = n ? pr / n : 0, a = 9 / 16;
	return r > (t === "tall" ? 1 / (2 * a + i) : t === "wide" ? (2 + i) / a : 1 / a) * 1.02 ? "contain" : "cover";
}
function br(e) {
	let t = xr(e);
	if (t) {
		if (t < 1.2) return "tall";
		if (t > 2.4) return "wide";
	}
}
function xr(e) {
	let t = e?.streams.sub?.encoding, n = t?.width, r = t?.height;
	return n && r ? n / r : void 0;
}
var Sr = class extends M {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		_error: { state: !0 }
	};
	_data = new Ut(this);
	willUpdate() {
		this._data.hass = this.hass;
	}
	render() {
		let e = this._data;
		if (e.error) return O`<div class="banner error" role="alert">
        Could not load live view: ${e.error}
        <button
          @click=${() => {
			e.reload();
		}}
        >
          Retry
        </button>
      </div>`;
		if (!e.cameras) return O`<p class="muted">Loading…</p>`;
		let t = Gt(e.cameras, this.deviceId);
		return t ? O`<div class="board">
        <rv-live-tile
          .hass=${this.hass}
          .camera=${t}
          .connection=${z(t)}
          .image=${e.images[t.id]}
          .iceServers=${e.iceServers}
          .warm=${Wt(this.hass, t)}
          .controls=${t.controls}
        ></rv-live-tile>
      </div>
      ${this._renderKeepWarm(t)}` : O`<p class="muted">This camera cannot be watched live.</p>`;
	}
	_renderKeepWarm(e) {
		let t = e.keep_warm_entity;
		if (!t) return A;
		let n = this.hass?.states[t]?.state;
		return O`<label class="keep-warm">
      <input
        type="checkbox"
        .checked=${n === "on"}
        ?disabled=${n !== "on" && n !== "off"}
        @change=${(e) => {
			let n = e.target.checked;
			this.hass?.callService("switch", n ? "turn_on" : "turn_off", { entity_id: t }).catch((e) => {
				this._error = N(e).message;
			});
		}}
      />
      <span>
        <strong>Keep warm</strong>
        <span class="muted small"
          >Keeps the camera connected so its live view starts at once. Uses one of
          its NVR's or camera's stream slots all the time.</span
        >
      </span>
    </label>
    ${this._error ? O`<div class="banner error" role="alert">Could not change it: ${this._error}</div>` : A}`;
	}
	static styles = [F, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 1280px;
      }
      /* Video sits on the board's ink, with a margin of it. */
      .board {
        padding: 10px;
        background: var(--rv-board);
      }
      .keep-warm {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .keep-warm > span {
        display: flex;
        flex-direction: column;
      }
    `];
};
customElements.get("rv-live-grid") || customElements.define("rv-live-grid", hr), customElements.get("rv-live-camera") || customElements.define("rv-live-camera", Sr);
//#endregion
//#region src/catalog.ts
var Cr = {
	id: "other",
	title: "Other",
	description: "Entities this version of Reolink Viewer does not know yet."
};
function wr(e, t, n) {
	if (e && n !== null) return e.entities[t]?.[n];
}
function Tr(e, t) {
	let n = t.indexOf(".");
	if (!(n < 0)) return wr(e, t.slice(0, n), t.slice(n + 1));
}
function Er(e) {
	return [...e?.categories ?? [], Cr];
}
function Dr(e, t) {
	if (e?.impact !== "disruptive") return null;
	let n = e.disruptive_when ?? "any", r;
	return r = Array.isArray(n) ? typeof t == "object" && n.includes(t.option) : n === "any" || t === n, r ? e.impact_note ?? "This action can disrupt the camera." : null;
}
function Or(e, t) {
	return e.name ?? t?.title ?? e.entity_id;
}
var kr = (e) => e.toLowerCase();
function Ar(e, t, n) {
	let r = kr(n).split(/\s+/).filter(Boolean);
	if (!r.length) return !0;
	let i = kr([
		e.name ?? "",
		e.entity_id,
		e.sub_device ?? "",
		t?.title ?? "",
		t?.summary ?? "",
		t?.what_it_does ?? ""
	].join(" "));
	return r.every((e) => i.includes(e));
}
//#endregion
//#region src/services.ts
function jr(e, t) {
	switch (e) {
		case "switch":
		case "light":
		case "siren": return {
			domain: e,
			service: t === !0 ? "turn_on" : "turn_off",
			data: {}
		};
		case "number": return {
			domain: e,
			service: "set_value",
			data: { value: t }
		};
		case "select": return {
			domain: e,
			service: "select_option",
			data: { option: t }
		};
		case "time": return {
			domain: e,
			service: "set_value",
			data: { time: t }
		};
		case "button": return {
			domain: e,
			service: "press",
			data: {}
		};
		case "update": return {
			domain: e,
			service: "install",
			data: {}
		};
		default: throw Error(`${e} entities cannot be changed`);
	}
}
function Mr(e) {
	return {
		domain: "light",
		service: "turn_on",
		data: { brightness_pct: e }
	};
}
//#endregion
//#region src/writes.ts
var Nr = 1e4, Pr = class {
	_now;
	_pending = /* @__PURE__ */ new Map();
	constructor(e = () => Date.now()) {
		this._now = e;
	}
	begin(e, t, n) {
		let r = {
			value: t,
			base: n,
			confirmedAt: null
		};
		return this._pending.set(e, r), r;
	}
	confirm(e, t) {
		this._pending.get(e) === t && (t.confirmedAt = this._now());
	}
	fail(e, t) {
		return this._pending.get(e) === t && (this._pending.delete(e), !0);
	}
	isPending(e) {
		return this._pending.get(e)?.confirmedAt === null;
	}
	valueFor(e) {
		return this._pending.get(e)?.value;
	}
	settle(e) {
		let t = !1, n = this._now();
		for (let [r, i] of this._pending) {
			let a = i.confirmedAt !== null && n - i.confirmedAt > 1e4;
			(e[r] !== i.base || a) && (this._pending.delete(r), t = !0);
		}
		return t;
	}
	get size() {
		return this._pending.size;
	}
}, Fr = 1, Ir = class extends M {
	static properties = {
		hass: { attribute: !1 },
		device: { attribute: !1 },
		catalog: { attribute: !1 },
		_connection: { state: !0 },
		_search: { state: !0 },
		_showDisabled: { state: !0 },
		_open: { state: !0 },
		_confirm: { state: !0 },
		_enabling: { state: !0 }
	};
	writes = new Pr();
	renderMs;
	_created = performance.now();
	_settleTimer;
	constructor() {
		super(), this._search = "", this._showDisabled = !1, this._open = /* @__PURE__ */ new Set(), this._enabling = /* @__PURE__ */ new Set();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearTimeout(this._settleTimer), this._confirm?.resolve(!1), this._confirm = void 0;
	}
	willUpdate(e) {
		e.has("hass") && this.hass && this.writes.settle(this.hass.states);
	}
	firstUpdated() {
		this.renderMs = performance.now() - this._created, this.dataset.renderMs = this.renderMs.toFixed(1);
	}
	get connection() {
		let e = this.device?.connections ?? [];
		if (this._connection !== void 0) return e[this._connection];
		let t;
		for (let n of e) (!t || n.entities.length > t.entities.length) && (t = n);
		return t;
	}
	_rows(e) {
		let t = /* @__PURE__ */ new Map();
		for (let n of e.entities) {
			if (n.disabled_by !== null && !this._showDisabled) continue;
			let e = wr(this.catalog, n.domain, n.key);
			if (!Ar(n, e, this._search)) continue;
			let r = t.get(n.category) ?? [];
			r.push({
				entity: n,
				entry: e,
				label: Or(n, e)
			}), t.set(n.category, r);
		}
		for (let e of t.values()) e.sort((e, t) => e.label.localeCompare(t.label));
		return t;
	}
	render() {
		let e = this.connection;
		if (!this.device || !e) return O`<p class="muted">No settings.</p>`;
		let t = this._rows(e), n = e.entities.filter((e) => e.disabled_by !== null).length, r = Er(this.catalog).filter((e) => t.has(e.id));
		return O`
      <div class="toolbar">
        <input
          class="search"
          type="search"
          placeholder="Search settings"
          aria-label="Search settings"
          .value=${this._search}
          @input=${(e) => {
			this._search = e.target.value;
		}}
        />
        <label class="small">
          <input
            type="checkbox"
            .checked=${this._showDisabled}
            @change=${(e) => {
			this._showDisabled = e.target.checked;
		}}
          />
          Show disabled entities (${n})
        </label>
      </div>
      ${this._renderConnections()}
      ${this._showDisabled ? O`<p class="banner info small">
            Home Assistant creates some Reolink entities disabled.
            ${this.hass?.user?.is_admin ? "Enabling one makes Home Assistant reload the Reolink integration entry for this device after about 30 seconds; its entities are briefly unavailable and the new one appears then." : "An administrator can enable them."}
          </p>` : A}
      ${r.length ? r.map((e) => O`<section class="category">
              <h3>${e.title}</h3>
              <p class="muted small">${e.description}</p>
              <ul class="rows">
                ${(t.get(e.id) ?? []).map((e) => this._renderRow(e))}
              </ul>
            </section>`) : O`<p class="muted">No settings match “${this._search}”.</p>`}
      ${this._renderConfirm()}
    `;
	}
	_renderConnections() {
		let e = this.device?.connections ?? [];
		if (e.length < 2) return A;
		let t = this.connection;
		return O`<div class="connections" role="radiogroup" aria-label="Settings through">
      <span class="small muted">Settings through</span>
      ${e.map((e, n) => O`<button
          role="radio"
          aria-checked=${e === t ? "true" : "false"}
          class=${e === t ? "primary" : ""}
          @click=${() => {
			this._connection = n;
		}}
        >
          ${Lr(e)} · ${e.entities.length} settings
        </button>`)}
      <span class="small muted">
        Both connections reach the same camera; a change made through either applies to it.
      </span>
    </div>`;
	}
	_renderRow(e) {
		let { entity: t, entry: n, label: r } = e, i = this._open.has(t.entity_id);
		return O`<li class="row" data-entity-id=${t.entity_id}>
      <div class="info">
        <div class="label">
          ${r}
          ${t.sub_device ? O`<span class="badge">${t.sub_device}</span>` : A}
          ${t.disabled_by === null ? A : O`<span class="badge">Turned off</span>`}
          ${t.hidden_by === null ? A : O`<span class="badge">Hidden</span>`}
          ${t.entity_category === "diagnostic" ? O`<span class="badge">Read only</span>` : A}
          ${n?.impact === "disruptive" ? O`<span class="badge warning" title=${n.impact_note ?? ""}>Asks first</span>` : A}
        </div>
        ${n ? O`<div class="muted small">${n.summary}</div>` : A}
      </div>
      <div class="control">${this._renderControl(t, r)}</div>
      ${n ? O`<details
            class="about"
            .open=${i}
            @toggle=${(e) => {
			this._setOpen(t.entity_id, e.target.open);
		}}
          >
            <summary class="small">About this setting${P("chevronDown")}</summary>
            ${i ? this._renderAbout(n) : A}
          </details>` : A}
    </li>`;
	}
	_setOpen(e, t) {
		if (this._open.has(e) === t) return;
		let n = new Set(this._open);
		t ? n.add(e) : n.delete(e), this._open = n;
	}
	_renderAbout(e) {
		let t = e.related.map((e) => Tr(this.catalog, e)?.title).filter((e) => e !== void 0);
		return O`<div class="about-body small">
      ${e.verification === "unverified" ? O`<p class="unverified">
            <span class="badge warning">unverified</span> Reolink does not document exactly what
            this does; the text says only what is known.
          </p>` : A}
      <p>${e.what_it_does}</p>
      ${e.tradeoffs ? O`<p><strong>Trade-offs:</strong> ${e.tradeoffs}</p>` : A}
      ${e.impact === "disruptive" ? O`<p><strong>Impact:</strong> ${e.impact_note}</p>` : A}
      <p><strong>Requires:</strong> ${e.requires}</p>
      ${e.notes ? O`<p>${e.notes}</p>` : A}
      ${t.length ? O`<p><strong>Related:</strong> ${t.join(", ")}</p>` : A}
      <p>
        <strong>Sources:</strong>
        ${e.sources.map((e, t) => O`${t ? ", " : ""}<a href=${e.url} target="_blank" rel="noreferrer"
              >${e.title}</a
            >`)}
      </p>
    </div>`;
	}
	_renderControl(e, t) {
		if (e.disabled_by !== null) {
			if (!this.hass?.user?.is_admin) return O`<span class="muted small">Disabled</span>`;
			let n = this._enabling.has(e.entity_id);
			return O`<button ?disabled=${n} @click=${() => void this._enable(e, t)}>
        ${n ? "Enabling…" : "Enable"}
      </button>`;
		}
		let n = this.hass?.states[e.entity_id];
		if (!n) return O`<span class="muted small">Not loaded yet</span>`;
		let r = e.entity_id, i = this.writes.isPending(r), a = this.writes.valueFor(r), o = n.state === "unavailable" || i;
		switch (e.domain) {
			case "switch":
			case "siren": return this._toggle(e, t, a ?? n.state === "on", o && !i);
			case "light": return this._light(e, t, n, a, o && !i);
			case "number": return this._number(e, t, n, a, o);
			case "select": return this._select(e, t, n, a, o);
			case "time": return O`<input
          type="time"
          step="1"
          aria-label=${t}
          .value=${String(a ?? (/^\d\d:\d\d/.test(n.state) ? n.state : ""))}
          ?disabled=${o}
          @change=${(n) => {
				let r = n.target.value;
				r && this._write(e, t, r, "any");
			}}
        />`;
			case "button": return O`<button
          ?disabled=${o}
          @click=${() => void this._write(e, t, "press", "any")}
        >
          ${i ? "Working…" : t}
        </button>`;
			case "update": return this._update(e, t, n, i);
			default: return O`<span class="value">${Br(n, e.domain)}</span>`;
		}
	}
	_toggle(e, t, n, r) {
		let i = n === !0;
		return O`<button
      class="toggle ${i ? "on" : ""}"
      role="switch"
      aria-label=${t}
      aria-checked=${i ? "true" : "false"}
      ?disabled=${r}
      @click=${() => void this._write(e, t, !i, i ? "off" : "on")}
    >
      <span class="knob"></span>
    </button>`;
	}
	_light(e, t, n, r, i) {
		let a = n.attributes.supported_color_modes, o = Array.isArray(a) && a.some((e) => e !== "onoff"), s = n.attributes.brightness, c = typeof s == "number" ? Math.round(s / 255 * 100) : 0, l = typeof r == "boolean" ? r : n.state === "on";
		return O`<span class="light">
      ${o && l ? O`<input
            type="range"
            min="1"
            max="100"
            aria-label="${t} brightness"
            .value=${String(typeof r == "number" ? r : c)}
            ?disabled=${i}
            @change=${(n) => {
			let r = Number(n.target.value);
			this._write(e, t, r, "on", Mr(r));
		}}
          />` : A}
      ${this._toggle(e, t, l, i)}
    </span>`;
	}
	_number(e, t, n, r, i) {
		let a = n.attributes, o = zr(a.min, 0), s = zr(a.max, 100), c = zr(a.step, 1), l = typeof a.unit_of_measurement == "string" ? a.unit_of_measurement : "", u = Number(n.state), d = typeof r == "number" ? r : u, f = Number.isFinite(d) ? String(d) : "", p = (n) => {
			let r = n.target, i = Number(r.value);
			r.value === "" || !Number.isFinite(i) || i < o || i > s ? r.value = f : i !== d && this._write(e, t, i, "any");
		};
		return O`<span class="number">
      ${a.mode === "box" ? A : O`<input
            type="range"
            min=${o}
            max=${s}
            step=${c}
            aria-label=${t}
            .value=${f}
            ?disabled=${i}
            @input=${(e) => {
			let t = e.target.nextElementSibling;
			t && (t.value = e.target.value);
		}}
            @change=${p}
          />`}
      <input
        class="box"
        type="number"
        min=${o}
        max=${s}
        step=${c}
        aria-label="${t} value"
        .value=${f}
        ?disabled=${i}
        @change=${p}
      />
      ${l ? O`<span class="unit muted small">${l}</span>` : A}
    </span>`;
	}
	_select(e, t, n, r, i) {
		let a = Array.isArray(n.attributes.options) ? n.attributes.options.map(String) : [], o = typeof r == "string" ? r : n.state;
		return O`<select
      aria-label=${t}
      ?disabled=${i}
      @change=${(n) => {
			let r = n.target, i = r.value;
			r.value = o, this._write(e, t, i, { option: i });
		}}
    >
      ${a.includes(o) ? A : O`<option value="" selected>—</option>`}
      ${a.map((e) => O`<option value=${e} ?selected=${e === o}>${Rr(e)}</option>`)}
    </select>`;
	}
	_update(e, t, n, r) {
		let i = n.attributes, a = typeof i.installed_version == "string" ? i.installed_version : "?", o = typeof i.latest_version == "string" ? i.latest_version : null, s = typeof i.supported_features == "number" ? i.supported_features : 0, c = i.in_progress === !0 || r, l = n.state === "on" && (s & Fr) !== 0;
		return O`<span class="update small">
      <span>
        ${a}${o && o !== a ? O` → <strong>${o}</strong>` : A}
        ${n.state === "off" ? O`<span class="muted">(up to date)</span>` : A}
      </span>
      ${l || c ? O`<button
            ?disabled=${c}
            @click=${() => void this._write(e, t, "install", "any")}
          >
            ${c ? "Installing…" : "Install"}
          </button>` : A}
    </span>`;
	}
	async _write(e, t, n, r, i) {
		let a = this.hass;
		if (!a) return;
		let o = Dr(wr(this.catalog, e.domain, e.key), r);
		if (o !== null && !await this.confirm(t, o)) return;
		let s = i ?? jr(e.domain, e.domain === "button" ? "press" : e.domain === "update" ? "install" : n), c = e.entity_id, l = this.writes.begin(c, n, a.states[c]);
		this.requestUpdate();
		try {
			await a.callService(s.domain, s.service, s.data, { entity_id: c }, !1), this.writes.confirm(c, l), this._scheduleSettle();
		} catch (e) {
			this.writes.fail(c, l) && L(this, `Could not change ${t}: ${N(e).message}`, "error");
		}
		this.requestUpdate();
	}
	_scheduleSettle() {
		clearTimeout(this._settleTimer), this._settleTimer = setTimeout(() => {
			this.hass && this.writes.settle(this.hass.states) && this.requestUpdate(), this.writes.size && this._scheduleSettle();
		}, Nr + 100);
	}
	confirm(e, t) {
		return this._confirm?.resolve(!1), new Promise((n) => {
			this._confirm = {
				title: e,
				message: t,
				resolve: (e) => {
					this._confirm = void 0, n(e);
				}
			};
		});
	}
	_renderConfirm() {
		let e = this._confirm;
		return e ? O`<div class="scrim" @click=${() => {
			e.resolve(!1);
		}}>
      <div
        class="dialog card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        @click=${(e) => {
			e.stopPropagation();
		}}
      >
        <h3 id="confirm-title">${e.title}</h3>
        <p>${e.message}</p>
        <p class="muted small">Do you want to continue?</p>
        <div class="actions">
          <button @click=${() => {
			e.resolve(!1);
		}}>Cancel</button>
          <button class="danger" @click=${() => {
			e.resolve(!0);
		}}>Continue</button>
        </div>
      </div>
    </div>` : A;
	}
	async _enable(e, t) {
		let n = this.hass;
		if (n) {
			this._enabling = /* @__PURE__ */ new Set([...this._enabling, e.entity_id]);
			try {
				let r = (await ze(n, e.entity_id)).reload_delay;
				L(this, `${t} enabled. Home Assistant reloads the Reolink entry${r ? ` in about ${r} seconds` : ""}; the entity becomes available after that.`), this.dispatchEvent(new CustomEvent("rv-entity-enabled", {
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				L(this, `Could not enable ${t}: ${N(e).message}`, "error");
			} finally {
				let t = new Set(this._enabling);
				t.delete(e.entity_id), this._enabling = t;
			}
		}
	}
	static styles = [F, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }
      .search {
        flex: 1;
        min-width: 180px;
        padding: 8px 10px;
      }
      .connections {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .connections button {
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
      }
      .connections button[aria-checked="true"],
      .connections button[aria-checked="true"]:hover {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .category {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 2px solid var(--rv-rule-strong);
      }
      .category h3 {
        margin: 0 0 2px;
        font-family: var(--rv-font-cond);
        font-size: 21px;
        font-weight: 600;
      }
      .category > p {
        margin: 0;
      }
      ul.rows {
        list-style: none;
        margin: 10px 0 0;
        padding: 0;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 16px;
        align-items: center;
        padding: 10px 0;
        border-top: 1px solid var(--rv-rule);
      }
      .label {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        font-size: 16px;
        font-weight: 500;
      }
      .control {
        justify-self: end;
      }
      .about {
        grid-column: 1 / -1;
      }
      .about summary {
        min-height: 28px;
        color: var(--rv-action);
        font-weight: 400;
      }
      .about-body p {
        margin: 6px 0;
      }
      .number,
      .light,
      .update {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .number input[type="range"],
      .light input[type="range"] {
        width: 160px;
        padding: 0;
        border: none;
        background: transparent;
        accent-color: var(--rv-action);
      }
      .box {
        width: 72px;
      }
      /* A switch: a square knob on a rail, the action colour when on. */
      .toggle {
        position: relative;
        width: 46px;
        min-height: 0;
        height: 26px;
        padding: 0;
        border-radius: 2px;
        border: 1px solid var(--rv-rule-strong);
        background: transparent;
      }
      .toggle:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .toggle .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 1px;
        background: var(--rv-muted);
        transition: left 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .toggle.on,
      .toggle.on:hover:not(:disabled) {
        border-color: var(--rv-action);
        background: var(--rv-action);
      }
      .toggle.on .knob {
        left: 23px;
        background: var(--rv-on-action);
      }
      .value {
        font-size: 14px;
      }
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(17, 20, 24, 0.55);
      }
      .dialog {
        max-width: 440px;
        margin: 16px;
        padding: 20px 22px;
        border-top: 6px solid var(--rv-fault);
        background: var(--rv-ground);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
      }
      .dialog h3 {
        font-family: var(--rv-font-cond);
        font-size: 22px;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      @media (max-width: 600px) {
        .row {
          grid-template-columns: 1fr;
        }
        .control {
          justify-self: start;
        }
        .number input[type="range"] {
          width: 120px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .toggle .knob {
          transition: none;
        }
      }
    `];
};
function Lr(e) {
	return e.via === "nvr" ? `Through ${e.host_name ?? e.entry_title}` : "Added directly";
}
function Rr(e) {
	let t = e.replace(/_/g, " ").replace(/\s*&\s*/g, " & ").trim();
	return t.charAt(0).toUpperCase() + t.slice(1);
}
function zr(e, t) {
	return typeof e == "number" && Number.isFinite(e) ? e : t;
}
function Br(e, t) {
	if (e.state === "unavailable") return "Unavailable";
	if (e.state === "unknown") return "Unknown";
	if (t === "binary_sensor") {
		let t = [
			"motion",
			"occupancy",
			"presence"
		].includes(String(e.attributes.device_class));
		if (e.state === "on") return t ? "Detected" : "On";
		if (e.state === "off") return t ? "Clear" : "Off";
	}
	let n = e.attributes.unit_of_measurement;
	return typeof n == "string" && n ? `${e.state} ${n}` : e.state;
}
customElements.get("rv-settings") || customElements.define("rv-settings", Ir);
//#endregion
//#region src/components/overview.ts
var Vr = 3e4, Hr = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, Ur = class extends M {
	static properties = {
		hass: { attribute: !1 },
		device: { attribute: !1 },
		devices: { attribute: !1 },
		cameras: { attribute: !1 },
		_stamp: { state: !0 }
	};
	_timer;
	constructor() {
		super(), this.cameras = [], this._stamp = 0;
	}
	connectedCallback() {
		super.connectedCallback(), this._startTimer();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._timer), this._timer = void 0;
	}
	updated(e) {
		e.has("device") && this._startTimer();
	}
	_startTimer() {
		clearInterval(this._timer), this._timer = void 0;
		let e = this.device?.node;
		e?.kind === "camera" && e.primary_view === "snapshot" && this.isConnected && (this._timer = setInterval(() => {
			document.visibilityState === "visible" && (this._stamp = Date.now());
		}, Vr));
	}
	snapshotUrl() {
		let e = this.device?.node;
		if (e?.kind !== "camera" || !e.snapshot_entity_id) return null;
		let t = this.hass?.states[e.snapshot_entity_id]?.attributes.entity_picture;
		return typeof t != "string" || !t ? null : this._stamp ? `${t}${t.includes("?") ? "&" : "?"}_=${this._stamp}` : t;
	}
	render() {
		let e = this.device;
		if (!e) return O``;
		let t = e.node;
		return O`
      ${t.kind === "camera" ? this._renderSnapshot(t) : this._renderCameras()}
      <div class="connections">${e.connections.map((t) => this._renderConnection(t, e))}</div>
    `;
	}
	_renderSnapshot(e) {
		let t = this.snapshotUrl(), n = e.primary_view === "snapshot";
		return O`<figure class="snapshot ${n ? "primary" : ""}">
      <div class="frame">
        ${t ? O`<img src=${t} alt="Latest snapshot of ${e.name ?? "the camera"}" />` : O`<p class="none">
              No snapshot: enable one of this camera's stream entities (for example
              <em>Fluent</em>) in the Settings tab.
            </p>`}
      </div>
      <figcaption>
        <span>Latest snapshot</span>
        <button
          class="text with-icon"
          ?disabled=${!t}
          @click=${() => {
			this._stamp = Date.now();
		}}
        >
          ${P("refresh")}Refresh
        </button>
      </figcaption>
      ${n ? O`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${Vr / 1e3} seconds while this page is open.
          </p>` : A}
    </figure>`;
	}
	_renderCameras() {
		let e = this.device?.node;
		if (e?.kind === "camera") return A;
		let t = e?.camera_ids.length ?? 0;
		return O`<section class="card">
      <h2>Cameras</h2>
      ${this.devices && e ? O`<rv-device-list .devices=${this.devices} .cameras=${this.cameras} .hostId=${e.id}></rv-device-list>` : O`<p class="muted">
            ${t} ${t === 1 ? "camera" : "cameras"} on this ${vt(e?.kind ?? "nvr")}.
          </p>`}
    </section>`;
	}
	_renderConnection(e, t) {
		let n = e.details, r = t.node.kind === "camera", i = [e.channel !== void 0 && e.channel !== null && e.via === "nvr" ? `channel ${String(e.channel + 1)}` : void 0, e.playback_source ? "playback source" : void 0].filter((e) => e !== void 0);
		return O`<section class="card">
      <div class="header">
        <h2>${r ? Lr(e) : "Device"}</h2>
        ${i.length ? O`<span class="muted">${i.join(" · ")}</span>` : A}
      </div>
      ${n === null ? O`<p class="muted">
            Details are unavailable${t.degraded ? " in degraded mode" : ""}.
          </p>` : O`
            ${n.channel ? Wr(n.channel) : A}
            ${e.via === "direct" || !r ? Gr(n.host) : A}
          `}
      <p class="muted small">
        ${e.entities.length} entities
        (${e.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [F, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 28px;
      }
      .header {
        display: flex;
        align-items: baseline;
        gap: 4px 14px;
        flex-wrap: wrap;
      }
      .header h2 {
        margin: 0;
      }
      .snapshot {
        margin: 0;
        max-width: 760px;
      }
      .snapshot.primary {
        max-width: none;
      }
      /* The picture sits on the board's ink, with a margin of it. */
      .frame {
        aspect-ratio: 16 / 9;
        display: grid;
        place-items: center;
        padding: 10px;
        box-sizing: border-box;
        background: var(--rv-board);
        color: var(--rv-on-board-muted);
      }
      .frame img {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 0;
        object-fit: contain;
      }
      .none {
        max-width: 40ch;
        padding: 16px;
        text-align: center;
      }
      figcaption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
        color: var(--rv-muted);
        font-size: 14px;
      }
      .connections {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
        gap: 28px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
    `];
};
function Wr(e) {
	let t = e.online ? e.sleeping ? "Asleep" : "Online" : "Offline";
	return O`<dl class="facts">
    <dt>Model</dt>
    <dd>${e.model}${e.model_id ? O` <span class="muted">(${e.model_id})</span>` : A}</dd>
    <dt>Hardware</dt>
    <dd>${e.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${e.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${t}</dd>
    <dt>Clear stream</dt>
    <dd>${yt(e.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${yt(e.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${Kr(e.network)}</dd>
    ${e.battery ? O`<dt>Battery</dt>
          <dd>
            ${e.battery.percent ?? "?"}%${e.battery.status ? ` · ${e.battery.status}` : ""}${e.battery.temperature_c === null ? "" : ` · ${e.battery.temperature_c} °C`}${e.wired_power ? " · on wired power" : ""}
          </dd>` : A}
    <dt>Recordings</dt>
    <dd>${e.supports_replay ? "Playback supported" : "No playback"}</dd>
    ${e.ai_types.length ? O`<dt>AI detection</dt>
          <dd>${e.ai_types.map((e) => Hr[e] ?? e).join(", ")}</dd>` : A}
    ${e.capabilities.length ? O`<dt>Features</dt>
          <dd class="chips">${e.capabilities.map((e) => O`<span class="badge">${e}</span>`)}</dd>` : A}
  </dl>`;
}
function Gr(e) {
	let t = e.ports;
	return O`<dl class="facts">
    ${e.device_type === "camera" ? A : O`<dt>Model</dt>
          <dd>${e.model ?? "?"}${e.model_id ? O` <span class="muted">(${e.model_id})</span>` : A}</dd>
          <dt>Hardware</dt>
          <dd>${e.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${e.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${e.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${Kr(e.network)} · ${t.http.https ? "HTTPS" : "HTTP"}${t.http.port ? ` port ${t.http.port}` : ""}${e.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${xt(t.rtsp.enabled)}${t.rtsp.port ? ` (${t.rtsp.port})` : ""} · RTMP
      ${xt(t.rtmp.enabled)}${t.rtmp.port ? ` (${t.rtmp.port})` : ""} · ONVIF
      ${xt(t.onvif.enabled)}${t.onvif.port ? ` (${t.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${e.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${e.storage.length ? e.storage.map((e, t) => O`${t ? O`<br />` : A}${e.type ?? "disk"} ${e.index + 1}:
              ${e.used_percent === null ? "?" : `${e.used_percent}% used`}${e.available === !1 ? " (not available)" : ""}`) : "none"}
    </dd>
    ${e.cpu_usage === null ? A : O`<dt>CPU</dt>
          <dd>${e.cpu_usage}%</dd>`}
    ${e.capabilities.length ? O`<dt>Host features</dt>
          <dd class="chips">${e.capabilities.map((e) => O`<span class="badge">${e}</span>`)}</dd>` : A}
  </dl>`;
}
function Kr(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", Ur);
//#endregion
//#region src/playback/check-util.ts
function qr(e) {
	let t = e.toLowerCase();
	if (t.endsWith(".ui.nabu.casa")) return "Nabu Casa";
	if (t.endsWith(".ts.net")) return "Tailscale";
	let n = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(t);
	if (n) {
		let [e = 0, t = 0] = n.slice(1, 3).map(Number);
		return e === 100 && t >= 64 && t < 128 ? "Tailscale" : e === 10 || e === 127 || e === 192 && t === 168 || e === 172 && t >= 16 && t < 32 ? "local" : "remote";
	}
	return t === "localhost" || t.endsWith(".local") || t.endsWith(".lan") || !t.includes(".") ? "local" : "own domain";
}
var Jr = (e) => /iPhone|iPad|iPod/.test(e);
function Yr(e) {
	return Jr(e) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}
function Xr(e, t) {
	return e.startsWith("iPhone") ? !Jr(t) : e.startsWith("Desktop") ? Jr(t) : !1;
}
function Zr(e) {
	let t = /Home ?Assistant\/([\d.]+)/i.exec(e), n = /(?:iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/.exec(e), r = /;\s*iOS (\d+)\.(\d+)/.exec(e);
	if (n) {
		let i = r ? `${r[1]}.${r[2]}` : `${n[1]}.${n[2]}`;
		return t ? `iOS ${i}, Companion app ${t[1]}` : /CriOS/.test(e) ? `iOS ${i}, Chrome` : /Safari\//.test(e) ? `iOS ${i}, Safari` : `iOS ${i}, web view`;
	}
	let i = /Mac OS X/.test(e) ? "macOS" : /Windows/.test(e) ? "Windows" : /Android/.test(e) ? "Android" : /Linux/.test(e) ? "Linux" : "?", a = /Edg\/(\d+)/.exec(e);
	if (a) return `Edge ${a[1]} (${i})`;
	let o = /(?:Chrome|Chromium)\/(\d+)/.exec(e);
	if (o) return `${/HeadlessChrome/.test(e) ? "Headless Chrome" : "Chrome"} ${o[1]} (${i})`;
	let s = /Firefox\/(\d+)/.exec(e);
	if (s) return `Firefox ${s[1]} (${i})`;
	let c = /Version\/([\d.]+).*Safari/.exec(e);
	return c ? `Safari ${c[1]} (${i})` : t ? `Companion app ${t[1]} (${i})` : `unknown browser (${i})`;
}
var q = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, J = (e) => e === void 0 ? "–" : Math.abs(e) >= 1e9 ? `${(e / 1e9).toFixed(2)} GB` : `${(e / 1e6).toFixed(1)} MB`;
function Y(e) {
	return e < 6e4 ? `${Math.round(e / 1e3)} s` : `${(e / 6e4).toFixed(1)} min`;
}
function Qr(e, t, n, r, i) {
	let a = e.end - e.start, o = e.start + a * n, s = e.start + a * r, c = t.filter((e) => e.start >= o && e.start <= s).at(-1);
	return {
		time: c ? c.start : Math.round(e.start + a * i),
		event: c
	};
}
function $r(e, t) {
	return e.filter((e) => e.end - e.start >= 12e5 && t - e.end > 6e4).sort((e, t) => t.start - e.start);
}
function ei(e) {
	let t = [];
	return e.forEach((n, r) => {
		let i = e.at(r + 1);
		i && i.start - n.end < 2e3 && t.push([n, i]);
	}), t.sort((e, t) => e[0].end - e[0].start - (t[0].end - t[0].start));
}
function ti(e) {
	return e.decoded && e.mediaS > 0 ? e.decoded / e.mediaS : void 0;
}
function ni(e) {
	let t = [`${(e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0).toFixed(2)}× effective`];
	e.applied !== e.rate && t.push(`browser set ${e.applied}×`);
	let n = ti(e);
	if (e.painted !== void 0) {
		let r = `${(e.painted * 1e3 / e.wallMs).toFixed(0)} fps painted`;
		t.push(n ? `${r} of ${(n * e.rate).toFixed(0)}` : r);
	}
	if (e.maxGapMs !== void 0 && t.push(`longest frame gap ${Math.round(e.maxGapMs)} ms`), e.decoded !== void 0 && e.dropped !== void 0) {
		let n = e.decoded ? (e.dropped * 100 / e.decoded).toFixed(1) : "0.0";
		t.push(`dropped ${e.dropped} of ${e.decoded} frames (${n} %)`);
	}
	return t.push(`${e.stalls} stalls${e.stalls ? ` (${Math.round(e.stalledMs)} ms)` : ""}`), e.ended && t.push("the file ended"), ii(e) || t.push("the dropped-frame counter disagrees with the frames painted: judged by those"), e.focused || t.push("PAGE NOT IN FRONT"), `${String(e.rate).padStart(3)}×: ${t.join(", ")}`;
}
var ri = "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % (or 1 frame) dropped, or 90 % painted where the dropped-frame counter disagrees with the frames painted";
function ii(e) {
	if (e.painted === void 0 || e.decoded === void 0 || e.dropped === void 0) return !0;
	let t = e.decoded - e.dropped;
	return Math.abs(t - e.painted) <= Math.max(3, e.decoded * .1);
}
function ai(e) {
	let t = e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0;
	if (Math.abs(t - e.rate) > e.rate * .1 || e.stalledMs >= 100) return !1;
	let n = ti(e), r = n === void 0 ? void 0 : n * e.rate;
	if (r !== void 0 && e.maxGapMs !== void 0) {
		let t = Math.max(250, 2500 / Math.min(r, 60));
		if (e.maxGapMs > t) return !1;
	}
	return r === void 0 || r > 50 ? !0 : !ii(e) && e.painted !== void 0 ? e.painted * 1e3 / e.wallMs >= r * .9 : !e.decoded || (e.dropped ?? 0) <= Math.max(1, e.decoded * .02);
}
function oi(e) {
	if (e.length < 2) return;
	let t = e.length, n = e.reduce((e, [t]) => e + t, 0) / t, r = e.reduce((e, [, t]) => e + t, 0) / t, i = 0, a = 0;
	for (let [t, o] of e) i += (t - n) * (o - r), a += (t - n) ** 2;
	return a ? i / a : void 0;
}
function si(e) {
	let t = 0;
	for (let n = 0; n < e.length; n += 1) t += e.end(n) - e.start(n);
	return t;
}
var ci = (e, t) => e === void 0 ? "not measured" : `${q(e)} ${e < t ? "✓" : "✗"}`, li = {
	h264: {
		codec: "avc1.42C00A",
		init: "AAAAHGZ0eXBpc281AAACAGlzbzVpc282bXA0MQAAAuhtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAB6nRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAEAAAAAAAYZtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAExbWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA8XN0YmwAAAClc3RzZAAAAAAAAAABAAAAlWF2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAQABAAEgAAABIAAAAAAAAAAEVTGF2YzYwLjMxLjEwMiBsaWJ4MjY0AAAAAAAAAAAAAAAY//8AAAAvYXZjQwFCwAr/4QAXZ0LACtkEJsBEAAADAAQAAAMAUDxImSABAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAChtdmV4AAAAIHRyZXgAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMA==",
		mdat: "AAAC+G1kYXQAAAJvBgX//2vcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgxOjB4MTExIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MiBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0xMCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD0xMCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAfZYiED/EYoAAlRxwABGYjgACJPJycnXXXXXXXXXXXXgAAAAZBmjgf4RgAAAAGQZpUB/hGAAAABkGaYD/CMAAAAAZBmoA/wjAAAAAGQZqgP8IwAAAABkGawD/CMAAAAAZBmuA/wjAAAAAGQZsAO8IwAAAABkGbIDfCMA==",
		normalized: "AAAAkG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAeHRyYWYAAAAcdGZoZAACADgAAAABAAAEAAAAApYBAQAAAAAAFHRmZHQBAAAAAAAAAAAAAAAAAABAdHJ1bgAAAgUAAAAKAAAAmAIAAAAAAAKWAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAK",
		absolute: "AAAAmG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAgHRyYWYAAAAkdGZoZAAAADkAAAABAAAAAAAAAwQAAAQAAAAClgEBAAAAAAAUdGZkdAEAAAAAAAAAAAAAAAAAAEB0cnVuAAACBQAAAAoAAACgAgAAAAAAApYAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAo=",
		noTfdt: "AAAAfG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAZHRyYWYAAAAcdGZoZAACADgAAAABAAAEAAAAApYBAQAAAAAAQHRydW4AAAIFAAAACgAAAIQCAAAAAAAClgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACg==",
		nvr: "AAAAhG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAbHRyYWYAAAAkdGZoZAAAADkAAAABAAAAAAAAAwQAAAQAAAAClgEBAAAAAABAdHJ1bgAAAgUAAAAKAAAAjAIAAAAAAAKWAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAK"
	},
	vp9: {
		codec: "vp09.00.10.08",
		init: "AAAAHGZ0eXBpc281AAACAGlzbzVpc282bXA0MQAAAuttb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAB7XRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAEAAAAAAAYltZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAE0bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA9HN0YmwAAACoc3RzZAAAAAAAAAABAAAAmHZwMDkAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAQABAAEgAAABIAAAAAAAAAAEYTGF2YzYwLjMxLjEwMiBsaWJ2cHgtdnA5AAAAAAAAAAAY//8AAAAUdnBjQwEAAAAACoICAgIAAAAAAApmaWVsAQAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAABOIAAATiAAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAChtdmV4AAAAIHRyZXgAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMA==",
		mdat: "AAAAuG1kYXSCSYNCAAPwA/YAOCQcGEIAADBgAAB4uf/+btv////RJ////Lkc/S6IAIYAQJKcAElAAAMgAABUcIYAQJKcAErAAAMgAABUcIYAQJKcAEnAAAMgAABUcIYAQJKcAEigAAMgAABUcIYAQJKcAEeAAAMgAABUcIYAQJKcAEbgAAMgAABUcIYAQJKcAEZAAAMgAABUcIYAQJKcAEXAAAMgAABUcIYAQJKcAEVAAAMgAABUcA==",
		normalized: "AAAAkG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAeHRyYWYAAAAcdGZoZAACADgAAAABAAAEAAAAACkBAQAAAAAAFHRmZHQBAAAAAAAAAAAAAAAAAABAdHJ1bgAAAgUAAAAKAAAAmAIAAAAAAAApAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAP",
		absolute: "AAAAmG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAgHRyYWYAAAAkdGZoZAAAADkAAAABAAAAAAAAAwcAAAQAAAAAKQEBAAAAAAAUdGZkdAEAAAAAAAAAAAAAAAAAAEB0cnVuAAACBQAAAAoAAACgAgAAAAAAACkAAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8=",
		noTfdt: "AAAAfG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAZHRyYWYAAAAcdGZoZAACADgAAAABAAAEAAAAACkBAQAAAAAAQHRydW4AAAIFAAAACgAAAIQCAAAAAAAAKQAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADw==",
		nvr: "AAAAhG1vb2YAAAAQbWZoZAAAAAAAAAABAAAAbHRyYWYAAAAkdGZoZAAAADkAAAABAAAAAAAAAwcAAAQAAAAAKQEBAAAAAABAdHJ1bgAAAgUAAAAKAAAAjAIAAAAAAAApAAAADwAAAA8AAAAPAAAADwAAAA8AAAAPAAAADwAAAA8AAAAP"
	}
}, ui = [
	{
		shape: "normalized",
		label: "MSE-ready fragment"
	},
	{
		shape: "absolute",
		label: "absolute offsets"
	},
	{
		shape: "noTfdt",
		label: "no tfdt"
	},
	{
		shape: "nvr",
		label: "NVR shape (both)"
	}
];
function di(e) {
	let t = window[e];
	return typeof t == "function" ? t : void 0;
}
function fi(e, t) {
	let n = di(e);
	if (n) try {
		return n.isTypeSupported(`video/mp4; codecs="${t}"`);
	} catch {
		return !1;
	}
}
function pi(e) {
	for (let [t, n] of Object.entries(li)) if (fi(e, n.codec)) return {
		name: t,
		sample: n
	};
}
var mi = (e) => Uint8Array.from(atob(e), (e) => e.charCodeAt(0));
function hi(e, t) {
	let n = new Uint8Array(e.length + t.length);
	return n.set(e), n.set(t, e.length), n;
}
function gi(e, t) {
	return new Promise((n, r) => {
		let i = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), n();
		}, a = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), r(/* @__PURE__ */ Error("append error"));
		};
		e.addEventListener("updateend", i), e.addEventListener("error", a), e.appendBuffer(t);
	});
}
async function _i(e, t, n, r = 5e3) {
	let i = di(e);
	if (!i) return "not available";
	let a = performance.now(), o = document.createElement("video");
	o.muted = !0, o.playsInline = !0, o.disableRemotePlayback = !0, o.style.cssText = "position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0", document.body.append(o);
	let s = new i(), c = URL.createObjectURL(s), l;
	try {
		let e = new Promise((e) => {
			l = setTimeout(() => {
				e(s.readyState === "open" ? "timed out" : "timed out (source never opened)");
			}, r), s.addEventListener("sourceopen", () => {
				(async () => {
					let i;
					try {
						i = s.addSourceBuffer(`video/mp4; codecs="${t.codec}"`);
					} catch (t) {
						e(`addSourceBuffer failed (${String(t)})`);
						return;
					}
					try {
						await gi(i, mi(t.init)), await gi(i, hi(mi(t[n]), mi(t.mdat)));
					} catch {
						e("append error");
						return;
					}
					if (!i.buffered.length) e("appended, nothing buffered");
					else {
						try {
							s.endOfStream();
						} catch {}
						e(await vi(o, r) ? `plays (${Math.round(performance.now() - a)} ms)` : "buffered, does not play");
					}
				})();
			}, { once: !0 });
		});
		return o.src = c, await e;
	} finally {
		clearTimeout(l), o.removeAttribute("src"), o.load(), o.remove(), URL.revokeObjectURL(c);
	}
}
function vi(e, t) {
	return new Promise((n) => {
		let r = setTimeout(() => {
			n(e.currentTime > 0);
		}, t), i = () => {
			e.currentTime > .05 && (clearTimeout(r), e.removeEventListener("timeupdate", i), n(!0));
		};
		e.addEventListener("timeupdate", i), e.play().catch(() => void 0);
	});
}
//#endregion
//#region src/playback/check.ts
var yi = "0.3.2", bi = [
	"Desktop Chrome, LAN",
	"Desktop Chrome, Tailscale",
	"Desktop Chrome, Nabu Casa",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
];
function xi(e) {
	return !/Tailscale|Nabu Casa/.test(e);
}
var Si = [
	.5,
	1,
	2,
	4,
	8
], Ci = 6e3, wi = 1e3, Ti = 6e4, Ei = 3e3, Di = 1e4, Oi = [
	-10,
	-5,
	3,
	8,
	15
], ki = 6e5, Ai = 3e5, ji = 15, Mi = 7, Ni = "reolink-viewer-check-running", Pi = class extends Error {}, Fi = (e) => new Promise((t) => setTimeout(t, e)), Ii = (e) => e.time;
function Li(e, t, n) {
	return new Promise((r) => {
		let i = setTimeout(() => {
			e.removeEventListener(t, a), r(!1);
		}, n), a = () => {
			clearTimeout(i), r(!0);
		};
		e.addEventListener(t, a, { once: !0 });
	});
}
var X = (e) => new Date(e).toLocaleTimeString(), Ri = class {
	_t;
	options;
	_onChange;
	id;
	lines = [];
	running = !1;
	_stopped = !1;
	_lastSave = 0;
	_saving = Promise.resolve();
	_long;
	_hdPlayed = !1;
	_summary = [];
	_plain = [];
	constructor(e, t, n = () => void 0) {
		this._t = e, this.options = t, this._onChange = n, this.id = `${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19)}-${Math.random().toString(36).slice(2, 6)}`;
	}
	get text() {
		return this.lines.join("\n");
	}
	stop() {
		this._stopped = !0;
	}
	async run() {
		this.running = !0, $i(this.id, this.options.setup);
		try {
			await this._header(), await this._timelines(), await this._events(), await this._deep(), await this._advance(), await this._rates(), await this._scrub(), await this._switchHd(), await this._link(), await this._capabilities(), this.options.soakMinutes > 0 && await this._soak();
			for (let e of Zt(this.inShort(!0))) this._log(e);
			this._log(""), this._log("Summary:");
			for (let e of this._summary) this._log(`- ${e}`);
		} catch (e) {
			this._log(e instanceof Pi ? "Stopped." : `Check failed: ${N(e).message}`);
		} finally {
			this._t.player?.pause(), this.running = !1, this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0), ea(this.id);
		}
		return this.text;
	}
	inShort(e = !this.running) {
		let t = [...this._plain], n = t.filter((e) => e.grade === "problem").length, r = t.filter((e) => e.grade === "slow").length, i = this._t.cameraName;
		return {
			headline: t.length ? `${e ? "" : "So far: "}${n ? `${H(n, "problem")} found with ${i}'s recordings on this device.` : r ? `${i}'s recordings play on this device, but ${H(r, "thing")} ${r === 1 ? "is" : "are"} slow.` : `${i}'s recordings play well on this device.`}` : e ? "Nothing was measured." : "Measuring…",
			findings: t
		};
	}
	_log(e) {
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > Di && this._save(!1);
	}
	_save(e) {
		return this._lastSave = performance.now(), this._saving = this._saving.then(() => this._t.hass.callWS({
			type: "reolink_viewer/playback/check_report",
			report_id: this.id,
			setup: this.options.setup,
			text: this.text,
			done: e
		})).then(() => void 0).catch(() => void 0), this._saving;
	}
	_checkStopped() {
		if (this._stopped) throw new Pi();
	}
	async _wait(e, t) {
		let n = performance.now() + t;
		for (; performance.now() < n;) {
			if (this._checkStopped(), e()) return !0;
			await Fi(100);
		}
		return e();
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await Fi(Math.min(250, t - performance.now()));
	}
	async _header() {
		let e = this._t, t = navigator.connection;
		this._log(`Reolink Viewer playback check v${yi} · ${this.options.setup} · ${e.cameraName} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${Zr(navigator.userAgent)} · page ${qr(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x` + (t?.effectiveType ? ` · network ${t.effectiveType}, ${t.downlink ?? "?"} Mbit/s (browser estimate)` : ""));
		let n = performance.getEntriesByType("navigation")[0];
		this._log(`User agent: ${navigator.userAgent}`), this._log(`Connection: page loaded over ${n?.nextHopProtocol || "? (from the app's cache)"}; each video request line gives its own (h2/h3 share one connection; http/1.1 allows 6 at once)`), this._log(`Player: ${e.mode} · file player delivery: ${e.progressive ? "progressive" : "whole file first (WebKit)"}`), this._summary.push(`Player: ${e.mode}`), await this._wait(() => !!e.day && !e.loading, 3e4);
	}
	async _loadDay(e) {
		let t = this._t, n = t.metrics.timelineMs;
		return t.selectDate(e), await this._wait(() => !t.loading && t.day?.date === e && t.metrics.timelineMs !== n, 6e4), t.metrics;
	}
	async _timelines() {
		let e = this._t, t = e.today;
		e.date !== t && await this._loadDay(t);
		let n = e.metrics;
		this._log(`A1 Time to timeline, today (as the tab opened): ${q(n.timelineMs)} (server: ${Zi(n.timelineServer)})`);
		let r = Number(t.slice(8, 10)), i = [...e.monthDays].filter((e) => e < r).sort((e, t) => t - e), a = i.at(Math.min(2, i.length - 1));
		if (a === void 0) {
			this._log("A2/A3 skipped: no earlier recording day this month"), this._summary.push(`Timeline: today ${ci(n.timelineMs, 1e3)}`), this._plain.push(n.timelineMs === void 0 ? {
				grade: "problem",
				text: "Today's recordings did not load."
			} : {
				grade: V(n.timelineMs, 1e3, 3e3),
				text: `Today's recordings appear on the timeline in ${B(n.timelineMs)}.`
			});
			return;
		}
		let o = `${t.slice(0, 8)}${String(a).padStart(2, "0")}`, s = await this._loadDay(o);
		this._log(`A2 Time to timeline, ${o}: ${q(s.timelineMs)} (server: ${Zi(s.timelineServer)})`), await this._loadDay(t);
		let c = await this._loadDay(o);
		this._log(`A3 Time to timeline, ${o} again: ${q(c.timelineMs)} (server: ${Zi(c.timelineServer)})`);
		let l = await this._loadDay(t);
		this._log(`A4 Time to timeline, today again: ${q(l.timelineMs)} (server: ${Zi(l.timelineServer)})`);
		let u = s.timelineServer?.cache === "fresh", d = [
			V(n.timelineMs, 1e3, 3e3),
			V(s.timelineMs, u ? 3e3 : 1e3, u ? 6e3 : 3e3),
			V(c.timelineMs, 1e3, 3e3)
		];
		this._plain.push(n.timelineMs === void 0 || s.timelineMs === void 0 || c.timelineMs === void 0 ? {
			grade: "problem",
			text: "The timeline of recordings did not always load."
		} : {
			grade: Yt(d),
			text: `Recordings appear on the timeline in ${B(n.timelineMs)} for today; an earlier day takes ${B(s.timelineMs)} the first time and ${B(c.timelineMs)} after that.`
		}), this._summary.push(`Timeline: today ${ci(n.timelineMs, 1e3)}, past day first ${ci(s.timelineMs, u ? 3e3 : 1e3)} (${u ? "cold, < 3 s" : "cached, < 1 s"}), again ${ci(c.timelineMs, 1e3)}`);
	}
	async _play(e) {
		let t = this._t;
		performance.clearResourceTimings(), performance.setResourceTimingBufferSize(1e3);
		let n = performance.now(), r = Ji(t.player, n), i = t.playing;
		await t.playAt(e, n);
		let a = t.playing === i ? void 0 : t.playing?.cache, o = await this._wait(() => t.metrics.firstFrameMs !== void 0 || !!t.playFailure, 12e4);
		r.stop();
		let s = t.metrics, c = t.player?.time, l = c === void 0 ? void 0 : c - e, u = l === void 0 || Math.abs(l) <= 2e3 ? "" : ` · STARTED AT ${X(c ?? 0)}, ${Y(Math.abs(l))} ${l < 0 ? "before" : "after"} the time asked`, d = t.playing?.file ? ` · ${t.playing.file} file` : "", f = `first frame ${o && !t.playFailure ? q(s.firstFrameMs) : "none"} [URL ${q(s.urlMs)} · metadata ${q(r.seen.loadedmetadata)} · seeked ${q(r.seen.seeked)} · playing ${q(r.seen.playing)}] ${s.delivery ?? "?"}${d} · ${s.stream ?? "?"} ${s.codec ?? ""}${u}${t.playFailure ? ` FAILED: ${t.playFailure}` : ""}`;
		return {
			ok: o && !t.playFailure && !u,
			line: f,
			began: n,
			source: t.playing?.base ?? t.playing?.url,
			held: a
		};
	}
	async _events() {
		let e = this._t, t = e.day, n = (t?.events ?? []).slice(-3).reverse();
		if (!t || !n.length) {
			this._log("B  skipped: no events today"), this._plain.push({
				grade: "note",
				text: "There were no events today to try opening."
			});
			return;
		}
		let r = [], i = [];
		for (let a of n) {
			let n = t.segments.find((e) => a.start >= e.start && a.start < e.end), o = n ? `${Y(a.start - n.start)} into a ${Y(n.end - n.start)} recording` : "no recording", s = await this._play(a.start);
			s.ok && e.metrics.firstFrameMs !== void 0 && (r.push(`${ci(e.metrics.firstFrameMs, 2e3)}${s.held?.complete === !1 ? " (not cached)" : ""}`), i.push(e.metrics.firstFrameMs)), this._log(`B  ${a.types.join("+")} at ${X(a.start)} (${o}): ${s.line}`), await Fi(300), this._log(`     ${Yi(s.began, s.source)}`), n && this._log(`     ${await this._fillReport()}`), await this._pause(1500);
		}
		this._summary.push(`Events → first frame (sub): ${r.join(", ") || "none played"}`);
		let a = Xt(i);
		this._plain.push(a === void 0 ? {
			grade: "problem",
			text: "Events would not play.",
			advice: "Run the check again; if it happens again, include the details below in a report."
		} : {
			grade: V(a, 2e3, 4e3),
			text: `Opening an event starts its video in ${i.length > 1 ? "about " : ""}${B(a)}${i.length < n.length ? `; ${String(n.length - i.length)} of ${H(n.length, "event")} did not play` : ""}.`
		});
	}
	async _peek(e, t) {
		let n = this._t;
		try {
			return await n.hass.callWS({
				type: "reolink_viewer/playback/peek",
				device_id: n.deviceId,
				date: e,
				segment_id: t,
				stream: "sub"
			});
		} catch {
			return;
		}
	}
	async _fillReport() {
		let e = this._t.playing, t = Xe(e?.base ?? e?.url ?? "");
		if (!t) return "server: nothing played";
		let n = e?.file === "plain", r = null;
		for (let e = 0; e < 90; e += 1) {
			try {
				r = (await Qe(this._t.hass, t)).cache;
			} catch {
				r = null;
			}
			if (!r || r.error || r.complete && (!n || r.flat !== void 0)) break;
			await this._pause(1e3);
		}
		if (!r) return "server: not cached (or its URL expired)";
		let i = [r.cache === "disk" ? "from disk" : `fill (${Vi(r.priority)})`];
		for (let [e, t] of [
			["wait_ms", "queue"],
			["headers_ms", "NVR headers"],
			["ttfb_ms", "NVR first byte"],
			["fill_ms", "download"]
		]) typeof r[e] == "number" && i.push(`${t} ${q(r[e])}`);
		return typeof r.mbit_s == "number" && i.push(`${r.mbit_s} Mbit/s`), i.push(J(r.bytes)), r.indexed !== void 0 && i.push(`index ${Vi(r.indexed)}`), (n || r.flat !== void 0) && i.push(`plain MP4 ${r.flat === void 0 ? "not yet" : Vi(r.flat)}`), typeof r.flat_ms == "number" && i.push(`rewrite ${q(r.flat_ms)}`), typeof r.flat_moov_bytes == "number" && i.push(`moov ${J(r.flat_moov_bytes)}`), r.error && i.push(`error ${r.error}`), `server: ${i.join(", ")}`;
	}
	async _findLong() {
		let e = this._t, t = e.today, n = Number(t.slice(8, 10)), r = [t, ...[...e.monthDays].filter((e) => e < n).sort((e, t) => t - e).slice(0, Mi).map((e) => `${t.slice(0, 8)}${String(e).padStart(2, "0")}`)], i = 0, a;
		for (let t of r) {
			let n;
			try {
				n = t === e.date && e.day ? e.day : await He(e.hass, e.deviceId, t);
			} catch {
				continue;
			}
			for (let e of $r(n.segments, n.now)) {
				if (i >= ji) return a;
				i += 1;
				let r = await this._peek(t, e.id);
				if (r && !r.cache) return {
					date: t,
					day: n,
					segment: e,
					cached: !1
				};
				r?.cache?.complete && !a && (a = {
					date: t,
					day: n,
					segment: e,
					cached: !0
				});
			}
		}
		return a;
	}
	async _deep() {
		let e = this._t, t = await this._findLong();
		if (this._long = t, !t) {
			this._log("D  skipped: no recording of 20 min or more in the last 7 days (events-only camera?)");
			return;
		}
		e.date !== t.date && await this._loadDay(t.date);
		let n = t.segment, r = Y(n.end - n.start), i = (e) => `${Y(e.time - n.start)} into a ${r} recording of ${t.date}` + (e.event ? ` (event ${e.event.types.join("+")} at ${X(e.event.start)})` : " (no event there: a point)"), a;
		if (t.cached) this._log("D1 skipped: every long recording looked at is cached already (try again after other recordings were viewed)");
		else {
			let r = Qr(n, t.day.events, .5, .95, .75), o = await this._play(r.time), s = o.held;
			o.ok && s?.complete === !1 && (a = e.metrics.firstFrameMs);
			let c = s?.complete ? "Not cached when chosen, but on disk when played (not counted)" : s?.bytes ? `Not cached (${J(s.bytes)} already fetched when played)` : "Not cached";
			this._log(`D1 ${c}, ${i(r)}: ${o.line}`), await Fi(300), this._log(`     ${Yi(o.began, o.source)}`), this._log(`     ${await this._fillReport()}`);
		}
		await this._pause(1500);
		let o = Qr(n, t.day.events, .1, .45, .4), s = await this._play(o.time), c = s.held?.complete === !1, l = s.ok && !c ? e.metrics.firstFrameMs : void 0;
		this._log(`D2 ${c ? "Cached when chosen, but not on disk when played (not counted)" : "Cached"}, ${i(o)}: ${s.line}`), await Fi(300), this._log(`     ${Yi(s.began, s.source)}`), this._summary.push(`Deep start (sub, ${r} recording): not cached ${a === void 0 ? "not measured" : q(a)}, cached ${ci(l, 2e3)}`), this._plain.push(l === void 0 ? {
			grade: "problem",
			text: "Jumping into the middle of a long recording did not play."
		} : {
			grade: V(l, 2e3, 4e3),
			text: `Jumping into the middle of a long recording starts in ${B(l)}` + (a === void 0 ? "." : `; the first time, ${B(a)}, while the recorder sends it over.`)
		});
	}
	async _advance() {
		let e = this._t, t = ei(e.day?.segments ?? []);
		!t.length && e.date !== e.today && (await this._loadDay(e.today), t = ei(e.day?.segments ?? []));
		let n = this._long, r = (n && n.date === e.day?.date ? t.find(([e]) => e.id === n.segment.id) : void 0) ?? t.at(0);
		if (!r) {
			this._log(`C  skipped: no two touching recordings on ${e.date}`);
			return;
		}
		let [i, a] = r, o = [], s = e.player, c = () => o.push("advanced"), l = () => o.push("ended");
		s?.addEventListener("rv-advanced", c), s?.addEventListener("rv-ended", l);
		try {
			await e.playAt(Math.max(i.start, i.end - 8e3), performance.now()), await this._wait(() => e.metrics.firstFrameMs !== void 0 || !!e.playFailure, 12e4);
			let t = await this._wait(() => e.player?.current?.segmentId === a.id && o.length > 0, 45e3);
			t && !o.includes("advanced") && await this._wait(() => e.metrics.firstFrameMs !== void 0 || !!e.playFailure, 6e4);
			let n = e.player, r;
			r = t ? o.includes("advanced") ? `yes (preloaded) · gap ${q(e.metrics.gapMs)}` : `yes, by reloading (the next file was not preloaded) · first frame ${q(e.metrics.firstFrameMs)}` : `no: on ${n?.current?.segmentId === i.id ? "the first" : n?.current ? "another" : "no"} recording at ${n?.time === void 0 ? "?" : X(n.time)}, ${n?.paused ? "paused" : "playing"}, next ${n?.preloaded ? "preloaded" : "not preloaded"}, events [${o.join(", ")}]`, this._log(`C  Moved on by itself at ${X(i.end)} (from a ${Y(i.end - i.start)} recording): ${r}` + (e.playFailure ? ` FAILED: ${e.playFailure}` : "")), this._summary.push(`Auto-advance: ${t && o.includes("advanced") ? `gap ${q(e.metrics.gapMs)}` : r}`);
			let s = e.metrics.gapMs ?? 0;
			this._plain.push(t ? o.includes("advanced") ? {
				grade: s < 500 ? "good" : s < 2e3 ? "fine" : "slow",
				text: `It plays straight on from one recording to the next${s < 100 ? ", without a noticeable pause" : `, with a pause of ${B(s)}`}.`
			} : {
				grade: "fine",
				text: `It moves on to the next recording by itself, after ${B(e.metrics.firstFrameMs ?? 0)} to load it.`
			} : {
				grade: "problem",
				text: "It did not move on to the next recording by itself.",
				advice: "Press Next, or tap the timeline, to carry on."
			});
		} finally {
			s?.removeEventListener("rv-advanced", c), s?.removeEventListener("rv-ended", l);
		}
	}
	async _rates() {
		let e = this._t, t = e.day?.segments ?? [], n = this._long, r = n && n.date === e.day?.date ? n.segment : [...t].sort((e, t) => t.end - t.start - (e.end - e.start)).at(0);
		if (!r) {
			this._log("R  skipped: no recording on this day");
			return;
		}
		let i = await this._play(r.start + (r.end - r.start) * .05);
		if (!i.ok) {
			this._log(`R  skipped: the recording did not play (${i.line})`);
			return;
		}
		this._log(`R  Playback rates, ${Y(r.end - r.start)} recording, ${Ci / 1e3} s each (sub stream):`);
		let a = [];
		try {
			for (let t of Si) {
				let n = Ki(e.player);
				if (!n) break;
				let r = await this._measureRate(n, t);
				if (a.push(r), this._log(`     ${ni(r)}`), r.ended) break;
			}
		} finally {
			let t = Ki(e.player);
			t && (t.playbackRate = 1);
		}
		this._summary.push(`Rates: ${a.map((e) => `${e.rate}× ${ai(e) ? "✓" : "✗"}`).join(" ") || "not measured"} (smooth = ${ri})`);
		let o = a.filter((e) => !ai(e));
		a.length && this._plain.push(o.length ? {
			grade: "slow",
			text: `Playback stutters at ${o.map((e) => `${String(e.rate)}×`).join(", ")} speed.`
		} : {
			grade: "good",
			text: `Slow motion and fast forward (${String(a[0]?.rate)}× to ${String(a.at(-1)?.rate)}×) play smoothly.`
		});
	}
	async _scrub() {
		let e = this._t.player, t = e?.current, n = Ki(e);
		if (!e || !t || !n || e.time === void 0) {
			this._log("S  skipped: nothing playing");
			return;
		}
		await this._pause(3e3);
		let r = Ii(e) ?? t.start, i = [], a = [], o = 0;
		for (let s of Oi) {
			let c = r + s * 1e3;
			if (c < t.start || c > t.end) continue;
			let l = performance.now(), u = Li(n, "seeked", 3e3);
			e.preview(c) ? await u && (i.push(performance.now() - l), o = Math.max(o, Math.abs((Ii(e) ?? c) - c))) : a.push(s);
		}
		let s = r + ki, c = s < t.end ? ` · ${Y(ki)} ahead: ${e.preview(s) ? "buffered, shown" : "not buffered (the thumbnail shows instead)"}` : "", l = i.length + a.length, u = i.length ? [...i].sort((e, t) => e - t)[Math.floor(i.length / 2)] : void 0;
		this._log(`S  Scrub preview (frames from the buffer while dragging): ${i.length} of ${l} points shown` + (u === void 0 ? "" : `, median ${q(u)}, each within ${(o / 1e3).toFixed(2)} s of its point`) + (a.length ? ` · not buffered: ${a.map((e) => `${e > 0 ? "+" : ""}${e} s`).join(", ")}` : "") + c), this._summary.push(`Scrub: ${i.length} of ${l} points in the buffer shown${u === void 0 ? "" : ` (median ${q(u)})`}`), l && this._plain.push(i.length === l ? {
			grade: V(u, 500, 1500),
			text: `Dragging along the timeline shows the video at once (in about ${B(u ?? 0)}).`
		} : {
			grade: "fine",
			text: `Dragging along the timeline shows the video at ${String(i.length)} of ${String(l)} points; elsewhere a thumbnail shows instead.`
		}), e.resume();
	}
	async _switchHd() {
		let e = this._t;
		if (!this.options.hd) {
			this._log("H  skipped: not asked for (tick \"with HD\")");
			return;
		}
		if (!e.hd.main) {
			this._log(`H  skipped: HD not offered (${e.hd.reason})`);
			return;
		}
		let t = e.player, n = t?.current;
		if (!t || !n || e.stream !== "sub") {
			this._log("H  skipped: nothing playing on the sub stream");
			return;
		}
		let r = e.day?.segments.find((e) => e.id === n.segmentId), i = r ? ` (${Y((t.time ?? r.start) - r.start)} into a ${Y(r.end - r.start)} recording)` : "", a = await this._switchTo("main");
		if (!a.ok) {
			this._log(`H  HD at ${X(a.at)}${i}: ${a.line}`), this._summary.push(`HD switch: ${a.line}`), this._plain.push({
				grade: "problem",
				text: "HD did not play; the viewer went back to SD.",
				advice: "SD still works. Include the details below if you report it."
			});
			return;
		}
		this._hdPlayed = !0, this._log(`H  HD at ${X(a.at)}${i}: ${a.line} · ${e.metrics.stream ?? "?"} ${e.metrics.codec ?? "?"} · ${e.metrics.delivery ?? "?"}`), this._log(`     ${await this._fillReport()}`), await this._pause(5e3);
		let o = await this._switchTo("sub");
		this._log(`     Back to SD at ${X(o.at)}: ${o.line}`), this._summary.push(`HD switch: to HD ${a.short}; back to SD ${o.short}`), this._plain.push({
			grade: Yt([V(a.ms, 3e3, 8e3), a.kept ? "good" : "fine"]),
			text: `Switching to HD takes ${B(a.ms ?? 0)}${a.kept ? " and keeps your place" : ", but starts at another moment"}${o.ok ? `; back to SD, ${B(o.ms ?? 0)}` : ""}.`
		});
	}
	async _switchTo(e) {
		let t = this._t, n = t.player, r = n?.time ?? 0, i = t.metrics.hdFailures ?? 0, a = () => (t.metrics.hdFailures ?? 0) > i;
		t.setStream(e);
		let o = await this._wait(() => t.metrics.stream === e && t.metrics.firstFrameMs !== void 0 || a() || !!t.playFailure, Ai), s = a() ? t.metrics.lastHdFailure ?? "HD failed" : t.playFailure;
		if (!o || s) {
			let e = s ? `FAILED: ${s} (back on the sub stream)` : `no first frame within ${Y(Ai)}`;
			return {
				ok: !1,
				at: r,
				line: e,
				short: e
			};
		}
		let c = t.metrics.firstFrameMs ?? 0, l = ((n?.time ?? r) - r) / 1e3, u = Math.abs(l) <= 1.5 ? "kept the moment" : "MOVED";
		return {
			ok: !0,
			at: r,
			ms: c,
			kept: u === "kept the moment",
			line: `first frame ${q(c)}, started ${l.toFixed(2)} s from where ${e === "main" ? "SD" : "HD"} was (${u})`,
			short: `${q(c)}, ${u} (${l.toFixed(2)} s)`
		};
	}
	async _measureRate(e, t) {
		e.playbackRate = t;
		let n = e.playbackRate;
		await this._pause(wi);
		let r = Bi(), i = setInterval(() => {
			r &&= Bi();
		}, 250), a = Wi(e), o = e.currentTime, s = performance.now(), c = 0, l, u = 0, d = !1, f = () => {
			c += 1, l ??= performance.now();
		}, p = () => {
			l !== void 0 && (u += performance.now() - l), l = void 0;
		}, m = () => {
			d = !0;
		};
		e.addEventListener("waiting", f), e.addEventListener("playing", p), e.addEventListener("ended", m);
		let h = qi(e);
		try {
			await this._pause(Ci);
		} finally {
			clearInterval(i), h.stop(), e.removeEventListener("waiting", f), e.removeEventListener("playing", p), e.removeEventListener("ended", m);
		}
		l !== void 0 && (u += performance.now() - l);
		let g = Wi(e);
		return {
			rate: t,
			applied: n,
			wallMs: performance.now() - s,
			mediaS: Math.max(0, e.currentTime - o),
			painted: h.painted,
			maxGapMs: h.maxGap,
			decoded: a && g ? g.totalVideoFrames - a.totalVideoFrames : void 0,
			dropped: a && g ? g.droppedVideoFrames - a.droppedVideoFrames : void 0,
			stalls: c,
			stalledMs: u,
			ended: d,
			focused: r && Bi()
		};
	}
	async _link() {
		let e = this._t.playing?.url ?? this._t.playing?.clip_url;
		if (!e) {
			this._log("L  skipped: nothing played");
			return;
		}
		let t = performance.now(), n = new AbortController(), r = setTimeout(() => {
			n.abort();
		}, Ei);
		try {
			let r = await fetch(e, {
				headers: { Range: "bytes=0-33554431" },
				cache: "no-store",
				signal: n.signal
			}), i = performance.now() - t, a = 0, o = r.body?.getReader();
			try {
				for (;;) {
					let e = await o?.read();
					if (!e || e.done) break;
					a += e.value.byteLength;
				}
			} catch {}
			let s = performance.now() - t, c = a * 8 / ((s - i) * 1e3);
			this._log(`L  Link to Home Assistant: ${J(a)} of the cached recording in ${q(s - i)} after the answer = ${c.toFixed(1)} Mbit/s (answer ${q(i)}, HTTP ${r.status})`), this._summary.push(`Link: ${c.toFixed(1)} Mbit/s`), this._plain.push({
				grade: c >= 16 ? "good" : c >= 4 ? "fine" : "slow",
				text: `Recordings come from Home Assistant at ${c.toFixed(0)} Mbit/s: ` + (c >= 16 ? "plenty for HD." : c >= 4 ? "enough for SD; HD may pause to load." : "SD may pause to load.")
			});
		} catch (e) {
			this._log(`L  Link test failed: ${N(e).message}`);
		} finally {
			clearTimeout(r);
		}
	}
	async _capabilities() {
		let e = this._t, t = {};
		try {
			t = await tt(e.hass, e.deviceId);
		} catch {}
		let n = t.sub?.codec, r = t.main?.codec, i = (e) => [["sub", n], ["main", r]].map(([t, n]) => n ? `${t} ${n} ${zi(fi(e, n))}` : `${t} codec unknown (not cached yet)`).join(", "), a = ["MediaSource", "ManagedMediaSource"];
		this._log(`MSE: ${a.map((e) => di(e) ? `${e} present (${i(e)})` : `${e} absent`).join(" · ")}`);
		let o = [];
		for (let e of a) {
			if (!di(e)) continue;
			let t = pi(e);
			if (!t) {
				this._log(`MSE probe (${e}): no sample codec supported`);
				continue;
			}
			let n = [];
			for (let { shape: r, label: i } of ui) this._checkStopped(), n.push(`${i} ${await _i(e, t.sample, r)}`);
			this._log(`MSE probe (${e}, ${t.name} sample): ${n.join(" · ")}`), o.push(`${e} ${n[0]?.includes("plays") ? "plays MSE-ready fragments" : "fails"}`);
		}
		this._summary.push(`MSE: ${o.join(", ") || "neither MediaSource nor ManagedMediaSource"}`);
		let s = document.createElement("video"), c = (e) => e ? `"${s.canPlayType(`video/mp4; codecs="${e}"`)}"` : "unknown";
		this._log(`Video: canPlayType sub ${c(n)}, main ${c(r)} · getVideoPlaybackQuality ${zi("getVideoPlaybackQuality" in s)} · requestVideoFrameCallback ${zi("requestVideoFrameCallback" in s)} · performance.memory ${zi(Hi() !== void 0)}`), this._log(`HD as the tab opened: ${e.hd.reason}${this._hdPlayed ? " (played in H above)" : ""}`), t.main?.width && t.main.height && r && this._log(`HD decodingInfo for ${r} at ${t.main.width}×${t.main.height}: ${await Xi(r, t.main.width, t.main.height)}`), this._hdPlayed || this._summary.push(`HD: ${e.hd.main ? "offered" : "not offered"} (${e.hd.reason})`), e.hd.main || this._plain.push({
			grade: "note",
			text: `HD is not offered on this device: ${e.hd.reason}.`
		});
	}
	async _soak() {
		let e = this._t, t = this.options.soakMinutes, n = this._long, r = n?.date ?? e.date;
		e.date !== r && await this._loadDay(r);
		let i = n?.segment ?? e.day?.segments[0];
		if (!i) {
			this._log("M  skipped: no recording to play");
			return;
		}
		this._log(`M  One-hour session: playing from ${X(i.start)} on ${r} for ${t} min, a sample a minute`);
		let a = e.player, o = 0, s = 0, c = [], l = () => {
			o += 1;
		}, u = (e) => {
			s += 1, c.push(e.detail.gapMs);
		}, d = [...a?.renderRoot.querySelectorAll("video") ?? []], f = [], p = [], m = 0, h = new Ui(), g = { minute: !0 }, ee = setInterval(() => {
			g.minute &&= Bi();
		}, 1e3), te = performance.now();
		try {
			await this._play(i.start), d.forEach((e) => {
				e.addEventListener("waiting", l);
			}), a?.addEventListener("rv-advanced", u);
			for (let n = 1; n <= t; n += 1) {
				if (await this._pause(Ti), e.player?.paused && document.visibilityState === "visible") {
					let t = e.day?.segments[0];
					this._log(`M  ${n} min: playback had stopped${e.playFailure ? ` (${e.playFailure})` : ""}; starting again from the day's first recording`), t && await e.playAt(t.start, performance.now());
				}
				let t = Ki(e.player), r = h.update(d), i = g.minute && Bi();
				g.minute = !0;
				let a = t ? Math.max(0, Gi(t) - t.currentTime) : 0;
				m = Math.max(m, a);
				let c = Hi();
				c !== void 0 && f.push([(performance.now() - te) / 36e5, c]);
				let l = await this._stats();
				l?.vod.disk_bytes !== void 0 && p.push(l.vod.disk_bytes);
				let u = d.reduce((e, t) => e + si(t.buffered), 0);
				this._log(`M  ${n} min: ${e.player?.time === void 0 ? "?" : X(e.player.time)} ${e.player?.paused ? "paused" : "playing"}` + (document.visibilityState === "visible" ? "" : " (page hidden: the system pauses video)") + (i ? "" : " · PAGE NOT IN FRONT this minute") + ` · heap ${c === void 0 ? "n/a" : J(c)} · ${a.toFixed(0)} s ahead, ${u.toFixed(0)} s buffered in both videos · dropped ${r} this minute, ${h.dropped} of ${h.decoded} in all · ${o} stalls · ${s} file changes` + (e.metrics.recoveries ? ` · ${e.metrics.recoveries} reloads mid-way` : "") + (l ? ` · cache ${J(l.vod.disk_bytes)} on disk + ${J(l.vod.reserved_bytes)} reserved, ${l.vod.leased ?? "?"} leased` : "")), $i(this.id, this.options.setup, n);
			}
		} finally {
			clearInterval(ee), d.forEach((e) => {
				e.removeEventListener("waiting", l);
			}), a?.removeEventListener("rv-advanced", u);
		}
		let _ = oi(f), ne = f.length ? `heap ${J(f[0]?.[1])} → ${J(f.at(-1)?.[1])} (max ${J(Math.max(...f.map(([, e]) => e)))}${_ === void 0 ? "" : `, ${_ >= 0 ? "+" : ""}${J(_)}/h`})` : "heap not measurable in this browser (the page was not reloaded)", re = (await this._stats())?.vod.max_bytes, ie = p.length ? `cache ${J(Math.min(...p))}–${J(Math.max(...p))} on disk (cap ${J(re)})` : "cache use unknown", v = `${t} min: ${ne}, at most ${m.toFixed(0)} s buffered ahead, ${h.dropped} of ${h.decoded} frames dropped, ${o} stalls, ${s} file changes${c.length ? ` (gaps ${c.map((e) => q(e)).join(", ")})` : ""}, ${e.metrics.recoveries ?? 0} reloads mid-way, ${ie}`;
		this._log(`M  Summary: ${v}`), this._summary.push(`Session: ${v}`);
		let y = h.decoded ? h.dropped / h.decoded : 0, b = e.metrics.recoveries ?? 0;
		this._plain.push({
			grade: !o && !b && y < .005 ? "good" : o <= 2 && y < .02 ? "fine" : "slow",
			text: `Played for ${H(t, "minute")}: ` + [
				o ? `it paused to load ${H(o, "time")}` : "it never paused to load",
				h.decoded ? `${y < .001 ? "no" : `${(y * 100).toFixed(1)}% of`} frames skipped` : void 0,
				b ? `reloaded ${H(b, "time")}` : void 0
			].filter(Boolean).join(", ") + "."
		});
	}
	async _stats() {
		try {
			return await this._t.hass.callWS({ type: "reolink_viewer/playback/stats" });
		} catch {
			return;
		}
	}
}, zi = (e) => e === void 0 ? "n/a" : e ? "yes" : "no", Bi = () => document.visibilityState === "visible" && document.hasFocus(), Vi = (e) => typeof e == "string" || typeof e == "number" ? String(e) : "?";
function Hi() {
	return performance.memory?.usedJSHeapSize;
}
var Ui = class {
	decoded = 0;
	dropped = 0;
	_last = /* @__PURE__ */ new Map();
	update(e) {
		let t = this.dropped;
		for (let t of e) {
			let e = Wi(t);
			if (!e) continue;
			let n = this._last.get(t), r = !n || e.totalVideoFrames < n.totalVideoFrames;
			this.decoded += r ? e.totalVideoFrames : e.totalVideoFrames - n.totalVideoFrames, this.dropped += r ? e.droppedVideoFrames : e.droppedVideoFrames - n.droppedVideoFrames, this._last.set(t, e);
		}
		return this.dropped - t;
	}
};
function Wi(e) {
	return typeof e.getVideoPlaybackQuality == "function" ? e.getVideoPlaybackQuality() : void 0;
}
function Gi(e) {
	let t = e.buffered;
	for (let n = 0; n < t.length; n += 1) if (t.start(n) <= e.currentTime + .5 && t.end(n) >= e.currentTime) return t.end(n);
	return e.currentTime;
}
function Ki(e) {
	return e?.renderRoot.querySelector("video.active") ?? null;
}
function qi(e) {
	if (typeof e.requestVideoFrameCallback != "function") return {
		painted: void 0,
		maxGap: void 0,
		stop: () => void 0
	};
	let t, n = 0, r = !1, i = {
		painted: 0,
		maxGap: 0,
		stop: () => {
			r = !0, e.cancelVideoFrameCallback(n);
		}
	}, a = (o) => {
		r || (i.painted = (i.painted ?? 0) + 1, t !== void 0 && (i.maxGap = Math.max(i.maxGap ?? 0, o - t)), t = o, n = e.requestVideoFrameCallback(a));
	};
	return n = e.requestVideoFrameCallback(a), i;
}
function Ji(e, t) {
	let n = {}, r = [...e?.renderRoot.querySelectorAll("video") ?? []], i = [
		"loadedmetadata",
		"seeked",
		"playing"
	].map((e) => {
		let i = (r) => {
			r.target.classList.contains("active") && (n[e] ??= performance.now() - t);
		};
		return r.forEach((t) => {
			t.addEventListener(e, i);
		}), [e, i];
	});
	return {
		seen: n,
		stop: () => {
			for (let [e, t] of i) for (let n of r) n.removeEventListener(e, t);
		}
	};
}
function Yi(e, t) {
	let n = t ? new URL(t, location.href).pathname : "", r = performance.getEntriesByType("resource").filter((t) => (t.initiatorType === "video" || t.initiatorType === "fetch" && t.name.includes("/api/reolink_viewer/mse/")) && t.startTime >= e - 5);
	if (!r.length) return "requests: none reported (this browser may not report video requests)";
	let i = r.filter((e) => e.requestStart > 0), a = i.slice(0, 10).map((t, r) => {
		let i = n && new URL(t.name).pathname.startsWith(n) ? "" : " (other file)", a = t.encodedBodySize ? ` · ${J(t.encodedBodySize)}` : "";
		return `#${r + 1}${i} +${Math.round(t.startTime - e)} ms: wait ${Math.round(t.requestStart - t.startTime)} · answer ${Math.round(t.responseStart - t.requestStart)} · ran ${Math.round(t.responseEnd - t.responseStart)} ms${a}`;
	}), o = i.length > 10 ? ` | … ${i.length - 10} more` : "", s = r.length - i.length, c = [...new Set(i.map((e) => e.nextHopProtocol).filter(Boolean))].join("/");
	return `requests${c ? ` (${c})` : ""}: ${i.length} sent${s ? `, ${s} cancelled before sending` : ""}: ${a.join(" | ")}${o}`;
}
async function Xi(e, t, n) {
	let r = navigator.mediaCapabilities;
	if (!r?.decodingInfo) return "MediaCapabilities absent";
	let i = [];
	for (let a of ["file", "media-source"]) try {
		let o = await r.decodingInfo({
			type: a,
			video: {
				contentType: `video/mp4; codecs="${e}"`,
				width: t,
				height: n,
				bitrate: 8e6,
				framerate: 25
			}
		});
		i.push(`${a}: ${o.supported ? "supported" : "not supported"}${o.supported ? `, ${o.smooth ? "smooth" : "not smooth"}, ${o.powerEfficient ? "power efficient" : "not power efficient"}` : ""}`);
	} catch (e) {
		i.push(`${a}: ${N(e).message}`);
	}
	return i.join(" · ");
}
function Zi(e) {
	if (!e) return "?";
	let t = [e.cache ?? "?"];
	e.age_s !== void 0 && t.push(`${Vi(e.age_s)} s old`);
	for (let [n, r] of [
		["queue_ms", "queue"],
		["files_ms", "recordings"],
		["events_ms", "events"],
		["total_ms", "total"]
	]) {
		let i = e[n];
		typeof i == "number" && t.push(`${r} ${q(i)}`);
	}
	return typeof e.warm == "string" && t.push(`background fetch: ${e.warm}`), t.join(", ");
}
function Qi() {
	try {
		return window.localStorage;
	} catch {
		return;
	}
}
function $i(e, t, n) {
	try {
		let r = Qi()?.getItem(Ni), i = {
			id: e,
			setup: t,
			started: r ? JSON.parse(r).started : (/* @__PURE__ */ new Date()).toISOString(),
			updated: (/* @__PURE__ */ new Date()).toISOString(),
			...n ? { minute: n } : {}
		};
		Qi()?.setItem(Ni, JSON.stringify(i));
	} catch {}
}
function ea(e) {
	try {
		let t = Qi()?.getItem(Ni);
		t && JSON.parse(t).id === e && Qi()?.removeItem(Ni);
	} catch {}
}
async function ta(e) {
	let t;
	try {
		let e = Qi()?.getItem(Ni);
		if (!e) return;
		t = JSON.parse(e), Qi()?.removeItem(Ni);
	} catch {
		return;
	}
	let n = t.minute ? ` in minute ${t.minute} of the one-hour session` : "", r = `The playback check started ${new Date(t.started).toLocaleString()} (${t.setup}) stopped without finishing${n}: the page was reloaded or closed after ${new Date(t.updated).toLocaleTimeString()}. In the iOS app this usually means the app ran out of memory.`;
	try {
		let { reports: n } = await e.callWS({ type: "reolink_viewer/playback/check_reports" }), i = n.find((e) => e.id === t.id);
		i && !i.done && await e.callWS({
			type: "reolink_viewer/playback/check_report",
			report_id: i.id,
			setup: i.setup,
			text: `${i.text}\nINTERRUPTED: ${r}`,
			done: !0
		});
	} catch {}
	return r;
}
var na = (e) => e.callWS({ type: "reolink_viewer/playback/check_reports" }), Z = 6e4, Q = 60 * Z, ra = 24 * Q, $ = [
	ra,
	6 * Q,
	Q,
	15 * Z,
	5 * Z
];
function ia(e, t, n) {
	return (e - t.start) / t.span * n;
}
function aa(e, t, n) {
	return t.start + e / n * t.span;
}
function oa(e, t) {
	let n = t.end - t.start, r = $[$.length - 1] ?? 6e4, i = Math.min(Math.max(e.span, r), Math.max(n, r));
	return i >= n ? {
		start: t.start,
		span: n
	} : {
		start: Math.min(Math.max(e.start, t.start), t.end - i),
		span: i
	};
}
function sa(e, t, n, r) {
	return oa({
		start: n - (n - e.start) / e.span * t,
		span: t
	}, r);
}
function ca(e) {
	let t = 0;
	return $.forEach((n, r) => {
		Math.abs(n - e) < Math.abs(($[t] ?? n) - e) && (t = r);
	}), t;
}
function la(e, t, n) {
	return oa({
		start: t - e.span / 2,
		span: e.span
	}, n);
}
var ua = [
	1e4,
	3e4,
	Z,
	5 * Z,
	10 * Z,
	15 * Z,
	30 * Z,
	Q,
	2 * Q,
	3 * Q,
	6 * Q
];
function da(e, t, n = 60) {
	for (let r of ua) if (r / e.span * t >= n) return r;
	return ua[ua.length - 1] ?? 36e5;
}
function fa(e, t, n) {
	let r = da(e, t), i = [], a = e.start + e.span, o = n(e.start), s = Math.ceil((e.start + o) / r) * r - o;
	for (let e = 0; s <= a && e < 500; e += 1) i.push(s), s += r;
	return i;
}
function pa(e, t, n, r = 1) {
	let i = r / n * t.span, a = t.start + t.span, o = [];
	for (let n of e) {
		if (n.end < t.start || n.start > a) continue;
		let e = o.at(-1);
		e && n.start - e.end <= i ? e.end = Math.max(e.end, n.end) : o.push({
			start: n.start,
			end: n.end
		});
	}
	return o;
}
function ma(e, t) {
	let n = 0, r = e.length - 1, i;
	for (; n <= r;) {
		let a = n + r >> 1, o = e.at(a);
		if (!o) break;
		o.start <= t ? (t < o.end && (i = o), n = a + 1) : r = a - 1;
	}
	return i;
}
function ha(e, t) {
	return e.find((e) => e.start > t);
}
function ga(e, t) {
	let n = ma(e, t);
	if (n) return {
		segment: n,
		offset: t - n.start
	};
	let r = ha(e, t);
	return r ? {
		segment: r,
		offset: 0
	} : void 0;
}
function _a(e, t) {
	return t.size === 0 ? e : e.filter((e) => Ta(e.types).some((e) => t.has(e)));
}
function va(e, t) {
	return e.find((e) => e.start > t + 500);
}
function ya(e, t) {
	let n;
	for (let r of e) if (r.start < t - 1500) n = r;
	else break;
	return n;
}
var ba = [
	{
		type: "PERSON",
		label: "Person"
	},
	{
		type: "VEHICLE",
		label: "Vehicle"
	},
	{
		type: "ANIMAL",
		label: "Animal"
	},
	{
		type: "CROSSLINE",
		label: "Line crossing"
	},
	{
		type: "INTRUSION",
		label: "Intrusion"
	},
	{
		type: "LINGER",
		label: "Loitering"
	},
	{
		type: "FACE",
		label: "Face"
	},
	{
		type: "DOORBELL",
		label: "Doorbell"
	},
	{
		type: "PACKAGE",
		label: "Package"
	},
	{
		type: "FORGOTTEN_ITEM",
		label: "Item left"
	},
	{
		type: "TAKEN_ITEM",
		label: "Item taken"
	},
	{
		type: "CRYING",
		label: "Crying"
	},
	{
		type: "IO",
		label: "Alarm input"
	},
	{
		type: "MOTION",
		label: "Motion"
	},
	{
		type: "TIMER",
		label: "Scheduled"
	}
], xa = new Map(ba.map((e, t) => [e.type, t]));
function Sa(e) {
	let t;
	for (let n of e) (t === void 0 || (xa.get(n) ?? 99) < (xa.get(t) ?? 99)) && (t = n);
	return t ?? "MOTION";
}
function Ca(e) {
	return ba[xa.get(e) ?? -1]?.label ?? e.toLowerCase();
}
function wa(e) {
	return [...e].sort((e, t) => (xa.get(e) ?? 99) - (xa.get(t) ?? 99));
}
function Ta(e) {
	let t = e.filter((e) => e !== "MOTION");
	return wa(t.length ? t : e.length ? e : ["MOTION"]);
}
function Ea(e) {
	return wa(new Set(e.flatMap((e) => Ta(e.types))));
}
function Da(e) {
	return e >= 216e5 ? 300 : e >= 36e5 ? 60 : e >= 9e5 ? 10 : 5;
}
function Oa(e, t, n) {
	let r = new Date(Date.UTC(e, t - 1, 1)).getUTCDay(), i = new Date(Date.UTC(e, t, 0)).getUTCDate(), a = (r - n % 7 + 7) % 7, o = [...Array.from({ length: a }, () => null), ...Array.from({ length: i }, (e, t) => t + 1)];
	for (; o.length % 7;) o.push(null);
	let s = [];
	for (let e = 0; e < o.length; e += 7) s.push(o.slice(e, e + 7));
	return s;
}
function ka(e, t, n) {
	let r = e * 12 + (t - 1) + n;
	return [Math.floor(r / 12), r % 12 + 1];
}
function Aa(e, t, n) {
	return `${String(e).padStart(4, "0")}-${String(t).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
//#endregion
//#region src/playback/calendar.ts
var ja = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], Ma = class extends M {
	static properties = {
		year: { type: Number },
		month: { type: Number },
		days: { attribute: !1 },
		selected: { attribute: !1 },
		today: { attribute: !1 },
		firstDay: { type: Number },
		loading: { type: Boolean }
	};
	constructor() {
		super();
		let e = /* @__PURE__ */ new Date();
		this.year = e.getFullYear(), this.month = e.getMonth() + 1, this.days = /* @__PURE__ */ new Set(), this.firstDay = 1, this.loading = !1;
	}
	_emit(e, t) {
		this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0
		}));
	}
	_move(e) {
		let [t, n] = ka(this.year, this.month, e);
		this._emit("rv-month", {
			year: t,
			month: n
		});
	}
	render() {
		let e = new Date(Date.UTC(this.year, this.month - 1, 15)).toLocaleDateString(void 0, {
			month: "long",
			year: "numeric",
			timeZone: "UTC"
		}), t = ja.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "narrow",
			timeZone: "UTC"
		})), [n, r] = ka(this.year, this.month, 1), i = this.today !== void 0 && Aa(n, r, 1) > this.today;
		return O`<div class="head">
        <button class="text" aria-label="Previous month" @click=${() => {
			this._move(-1);
		}}>${P("chevronBack")}</button>
        <span class="title">${e}${this.loading ? O` <span class="muted small">…</span>` : A}</span>
        <button class="text" aria-label="Next month" ?disabled=${i} @click=${() => {
			this._move(1);
		}}>${P("chevron")}</button>
      </div>
      <div class="grid" role="grid">
        ${t.map((e) => O`<span class="dow" role="columnheader">${e}</span>`)}
        ${Oa(this.year, this.month, this.firstDay).flat().map((e) => {
			if (e === null) return O`<span></span>`;
			let t = Aa(this.year, this.month, e), n = this.today !== void 0 && t > this.today, r = this.days.has(e);
			return O`<button
              role="gridcell"
              class="day ${t === this.selected ? "selected" : ""} ${t === this.today ? "today" : ""}"
              ?disabled=${n}
              aria-pressed=${t === this.selected ? "true" : "false"}
              aria-label="${t}${r ? ", has recordings" : ""}"
              @click=${() => {
				this._emit("rv-day", { date: t });
			}}
            >
              ${e}${r ? O`<span class="dot"></span>` : A}
            </button>`;
		})}
      </div>`;
	}
	static styles = [F, o`
      :host {
        display: block;
        min-width: 240px;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .title {
        font-weight: 500;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        text-align: center;
      }
      .dow {
        font-size: 12px;
        color: var(--secondary-text-color);
        padding: 4px 0;
      }
      .day {
        position: relative;
        padding: 6px 0 10px;
        border: none;
        border-radius: 0;
        background: transparent;
      }
      .day.today {
        font-weight: 700;
      }
      /* The chosen day in ink, as a pressed chip; a day with recordings marked in their rail blue. */
      .day.selected {
        background: var(--rv-text);
        color: var(--rv-ground);
      }
      .dot {
        position: absolute;
        left: 50%;
        bottom: 3px;
        width: 5px;
        height: 5px;
        margin-left: -2.5px;
        background: var(--rv-recording);
      }
      .day.selected .dot {
        background: var(--rv-ground);
      }
    `];
};
customElements.get("rv-calendar") || customElements.define("rv-calendar", Ma);
var Na = 12e4, Pa = 3600, Fa = 10, Ia = "rv-timetable-feed", La = class extends M {
	static properties = {
		hass: { attribute: !1 },
		cameras: { attribute: !1 },
		date: { attribute: !1 },
		heading: { attribute: !1 },
		limit: { attribute: !1 },
		cameraFilter: { attribute: !1 },
		typeFilter: { attribute: !1 },
		filters: { attribute: !1 },
		_feed: { state: !0 },
		_pick: { state: !0 },
		_error: { state: !0 },
		_all: { state: !0 },
		_thumbs: { state: !0 },
		_now: { state: !0 }
	};
	_seq = 0;
	_refresh;
	_clock;
	_thumbsAsked = /* @__PURE__ */ new Set();
	_newestBefore;
	constructor() {
		super(), this.cameras = [], this.heading = "Today", this.limit = 8, this.cameraFilter = /* @__PURE__ */ new Set(), this.typeFilter = /* @__PURE__ */ new Set(), this.filters = !1, this._pick = /* @__PURE__ */ new Set(), this._all = !1, this._thumbs = /* @__PURE__ */ new Map(), this._now = Date.now();
	}
	connectedCallback() {
		super.connectedCallback(), document.addEventListener("visibilitychange", this._onVisibility), this._refresh = setInterval(() => {
			document.visibilityState !== "hidden" && this._isToday && this._load(!0);
		}, Na), this._tick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), clearInterval(this._refresh), clearTimeout(this._clock);
	}
	_onVisibility = () => {
		document.visibilityState !== "hidden" && this._feed && this._isToday && this._load(!0);
	};
	_tick() {
		this._now = Date.now(), clearTimeout(this._clock), this._clock = setTimeout(() => {
			this._tick();
		}, 6e4 - this._now % 6e4 + 50);
	}
	get _isToday() {
		return this.date === void 0 || this.date === Un(this._now, this.hass?.config?.time_zone);
	}
	willUpdate(e) {
		e.has("date") && e.get("date") !== void 0 && (this._feed = void 0, this._error = void 0, this._all = !1, this._newestBefore = void 0);
	}
	updated(e) {
		let t = e.has("hass") && this.hass && !this._feed && this._seq === 0, n = e.has("date") && e.get("date") !== void 0;
		(t || n) && this._load(!1).then(() => this._isToday ? this._load(!0) : void 0), (e.has("cameraFilter") || e.has("typeFilter") || e.has("_pick")) && this._loadThumbs();
	}
	async _load(e) {
		let t = this.hass;
		if (!t) return;
		let n = ++this._seq, r = this.date;
		try {
			let i = await Ue(t, {
				...r === void 0 ? {} : { date: r },
				...e ? { background: e } : { maxAge: Pa }
			});
			if (n !== this._seq || r !== this.date) return;
			this._newestBefore = e ? this._feed?.events[0]?.start : void 0, this._feed = i, this._error = void 0, this.dispatchEvent(new CustomEvent(Ia, { detail: { feed: i } })), this._loadThumbs();
		} catch (e) {
			n === this._seq && (this._error = N(e).message);
		}
	}
	get _matching() {
		let e = this.cameraFilter.size ? this.cameraFilter : this._pick, t = this.typeFilter;
		return (this._feed?.events ?? []).filter((n) => (!e.size || e.has(n.camera_id)) && (!t.size || Ta(n.types).some((e) => t.has(e))));
	}
	get _shown() {
		let e = this._matching;
		return this._all ? e : e.slice(0, this.limit);
	}
	async _loadThumbs() {
		let e = this.hass;
		if (!e) return;
		let t = /* @__PURE__ */ new Map();
		for (let e of this._shown) {
			let n = za(e);
			this._thumbsAsked.has(n) || (this._thumbsAsked.add(n), t.set(e.camera_id, [...t.get(e.camera_id) ?? [], e.start]));
		}
		await Promise.all([...t].map(async ([t, n]) => {
			try {
				let { urls: r } = await et(e, t, n, Fa), i = new Map(this._thumbs);
				r.forEach((e, r) => i.set(`${t}:${String(n[r] ?? e.time)}`, e.url)), this._thumbs = i;
			} catch {}
		}));
	}
	_open(e) {
		let t = this.hass;
		t && e.new && (this._markOpened(e), Ge(t, e.camera_id, e.start).catch(() => void 0)), I(this, {
			view: "device",
			id: e.camera_id,
			tab: "playback",
			at: e.start
		});
	}
	_markOpened(e) {
		let t = this._feed;
		t && (this._feed = {
			...t,
			events: t.events.map((t) => t === e ? {
				...t,
				new: !1
			} : t)
		});
	}
	async _allSeen() {
		let e = this.hass, t = this._feed;
		if (e && t) {
			this._feed = {
				...t,
				events: t.events.map((e) => ({
					...e,
					new: !1
				}))
			};
			try {
				await Ke(e);
			} catch (e) {
				this._error = N(e).message;
			}
		}
	}
	render() {
		let e = this._feed, t = this._matching, n = this.hass?.config?.time_zone, r = new Set(t.map((e) => e.camera_id)).size, i = this.cameraFilter.size > 0 || this.typeFilter.size > 0 || this._pick.size > 0, a = this._isToday ? "today's" : "this day's";
		return O`<div class="head">
        ${this.heading ? O`<h2>${this.heading}</h2>` : A}
        ${e ? O`<p class="count">
              ${t.length ? `${String(t.length)} ${t.length === 1 ? "event" : "events"} on ${String(r)} ${r === 1 ? "camera" : "cameras"}` : i ? "None match" : this._isToday ? "No events yet" : "No events"}
            </p>` : A}
        ${(e?.events ?? []).some((e) => e.new) ? O`<button class="text all-seen" @click=${() => void this._allSeen()}>Mark all seen</button>` : A}
        ${this.filters ? O`<button class="text with-icon all-events" @click=${() => {
			I(this, { view: "events" });
		}}>All events${P("chevron")}</button>` : A}
      </div>
      ${this.filters && e ? this._renderPick(e) : A}
      ${this._error ? O`<p class="banner error" role="alert">Could not read ${a} events: ${this._error}</p>` : A}
      ${e ? this._renderTable(e, n) : this._error ? A : O`<p class="muted">Reading ${a} events…</p>`}`;
	}
	_renderPick(e) {
		let t = new Set(e.events.map((e) => e.camera_id)), n = this.cameras.filter((e) => t.has(e.id) || this._pick.has(e.id));
		return n.length < 2 ? A : O`<div class="pick" role="group" aria-label="Cameras">
      ${n.map((e) => O`<button
          class="chip"
          aria-pressed=${this._pick.has(e.id) ? "true" : "false"}
          @click=${() => {
			let t = new Set(this._pick);
			t.delete(e.id) || t.add(e.id), this._pick = t;
		}}
        >
          <span class="plat" aria-hidden="true">${e.number}</span>${e.name}
        </button>`)}
    </div>`;
	}
	_renderTable(e, t) {
		let n = this._matching, r = new Map(this.cameras.map((e) => [e.id, e])), i = n.length - this._shown.length, a = this._isToday, o = e.events.length ? "No events match these filters." : a ? "Nothing recorded an event since midnight." : "Nothing recorded an event on this day.";
		return O`<div class="cols" aria-hidden="true">
        <span>Time</span><span>Event</span><span>Camera</span><span class="right">Length</span><span></span>
      </div>
      ${a ? O`<div class="now"><b>${K(this._now, t)} now</b></div>` : A}
      ${n.length ? O`<ol class="rows">
            ${this._shown.map((e) => this._renderRow(e, r.get(e.camera_id), t))}
          </ol>` : O`<p class="muted empty">${o}</p>`}
      ${i > 0 ? O`<button
            class="text more"
            @click=${() => {
			this._all = !0, this.updateComplete.then(() => this._loadThumbs());
		}}
          >
            Show all ${n.length} events
          </button>` : A}
      ${e.failed.length ? O`<p class="failed">
            ${Ra(e.failed.map((e) => r.get(e.camera_id)?.name ?? "A camera"), a)}
          </p>` : A}`;
	}
	_renderRow(e, t, n) {
		let r = Va(e.types), i = K(e.start, n), a = t?.name ?? "Camera", o = this._thumbs.get(za(e));
		return O`<li class=${this._newestBefore !== void 0 && e.start > this._newestBefore ? "arrived" : ""}>
      <button
        class="row ${e.new ? "new" : ""}"
        aria-label="${r}, ${a}, ${i}${e.new ? ", new" : ""}: play the recording"
        @click=${() => {
			this._open(e);
		}}
      >
        <span class="t">${i}</span>
        <span class="ev">
          ${P(Ha(e.types))}<span>${r}</span>${e.new ? O`<span class="tag">New</span>` : A}
        </span>
        <span class="cam">${Ba(t)}<span class="name">${a}</span></span>
        <span class="len">${Ua(e.end - e.start)}</span>
        <span class="thumb">${o ? O`<img src=${o} alt="" loading="lazy" />` : A}</span>
        <span class="meta">${Ba(t)}${a} · ${Ua(e.end - e.start)}</span>
      </button>
    </li>`;
	}
	static styles = [F, o`
      :host {
        display: block;
        padding: 18px 24px 40px;
        container-type: inline-size;
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 14px;
        margin-bottom: 12px;
      }
      h2 {
        margin: 0;
        font-size: 26px;
      }
      .count {
        margin: 0;
        color: var(--rv-muted);
        font-size: 15px;
      }
      .all-seen {
        margin-left: auto;
      }
      .all-events {
        gap: 2px;
        padding-right: 0;
      }
      .all-seen + .all-events {
        margin-left: 8px;
      }
      .count + .all-events {
        margin-left: auto;
      }
      .all-events svg {
        width: 18px;
        height: 18px;
      }
      .pick {
        display: flex;
        gap: 6px;
        margin: -2px 0 14px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .chip {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 34px;
        padding: 0 12px 0 5px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip .plat {
        min-width: 22px;
        height: 22px;
        font-size: 14px;
      }
      .chip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .chip[aria-pressed="true"]:hover {
        background: var(--rv-text);
      }
      .cols,
      .row {
        display: grid;
        grid-template-columns: 96px minmax(0, 1.3fr) minmax(0, 1fr) 80px 104px;
        column-gap: 20px;
        align-items: center;
      }
      .cols {
        padding: 0 8px 6px;
        border-bottom: 1px solid var(--rv-rule-strong);
        color: var(--rv-muted);
        font-size: 13px;
        font-weight: 500;
      }
      .right {
        text-align: right;
      }
      .now {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 30px;
        color: var(--rv-red);
      }
      .now b {
        font-family: var(--rv-font-cond);
        font-size: 15px;
        font-weight: 600;
      }
      .now::after {
        content: "";
        flex: 1;
        height: 2px;
        background: var(--rv-red);
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        width: 100%;
        min-height: 62px;
        padding: 0 8px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .row:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .row:focus-visible {
        outline-offset: -2px;
      }
      .t {
        font-family: var(--rv-font-cond);
        font-size: 32px;
        font-weight: 600;
        line-height: 1;
      }
      .new .t {
        color: var(--rv-red);
      }
      .ev {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        font-size: 17px;
        font-weight: 500;
      }
      .ev svg {
        width: 22px;
        height: 22px;
        flex: none;
      }
      .tag {
        color: var(--rv-red);
        font-size: 13px;
        font-weight: 600;
      }
      .cam {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        font-size: 16px;
      }
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .plat {
        flex: none;
        min-width: 26px;
        height: 26px;
        padding: 0 4px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .len {
        text-align: right;
        color: var(--rv-muted);
        font-size: 16px;
      }
      .thumb {
        width: 104px;
        height: 58px;
        background: var(--rv-ground-2);
        overflow: hidden;
      }
      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .meta {
        display: none;
      }
      .arrived {
        animation: arrive 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes arrive {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
      }
      .more {
        margin-top: 10px;
      }
      .empty {
        padding: 14px 8px;
      }
      .failed {
        margin: 12px 0 0;
        padding: 8px 12px;
        background: var(--rv-fault);
        color: var(--rv-on-fault);
        font-size: 14px;
      }
      @container (max-width: 640px) {
        h2 {
          font-size: 22px;
        }
        .cols {
          display: none;
        }
        .row {
          grid-template-columns: 58px minmax(0, 1fr) 84px;
          column-gap: 12px;
          padding: 8px 4px;
          grid-template-areas: "t ev thumb" "t meta thumb";
        }
        .t {
          grid-area: t;
          font-size: 24px;
        }
        .ev {
          grid-area: ev;
          font-size: 15px;
        }
        .ev svg {
          width: 18px;
          height: 18px;
        }
        .cam,
        .len {
          display: none;
        }
        .thumb {
          grid-area: thumb;
          width: 84px;
          height: 47px;
        }
        .meta {
          grid-area: meta;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          color: var(--rv-muted);
          font-size: 14px;
        }
        .meta .plat {
          min-width: 20px;
          height: 20px;
          font-size: 13px;
        }
      }
      @media (max-width: 600px) {
        :host {
          padding: 14px 12px 32px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .arrived {
          animation: none;
        }
      }
    `];
};
function Ra(e, t) {
	return `${e.join(", ")}: ${t ? "today's" : "this day's"} recordings could not be searched, so some events may be missing.`;
}
function za(e) {
	return `${e.camera_id}:${String(e.start)}`;
}
function Ba(e) {
	return e ? O`<span class="plat" aria-hidden="true">${e.number}</span>` : A;
}
function Va(e) {
	return Ta(e).map(Ca).join(" · ");
}
function Ha(e) {
	if (e.includes("DOORBELL")) return "visitor";
	switch (Sa(e)) {
		case "PERSON":
		case "FACE": return "person";
		case "VEHICLE": return "vehicle";
		case "ANIMAL": return "animal";
		case "PACKAGE":
		case "FORGOTTEN_ITEM":
		case "TAKEN_ITEM": return "package";
		default: return "motion";
	}
}
function Ua(e) {
	let t = Math.max(0, Math.round(e / 1e3)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = String(t % 60).padStart(2, "0");
	return n ? `${String(n)}:${String(r).padStart(2, "0")}:${i}` : `${String(r)}:${i}`;
}
customElements.get("rv-timetable") || customElements.define("rv-timetable", La);
var Wa = class extends M {
	static properties = {
		events: { attribute: !1 },
		thumbs: { attribute: !1 },
		current: { attribute: !1 },
		playing: { attribute: !1 },
		timeZone: { attribute: !1 },
		_shown: { state: !0 }
	};
	constructor() {
		super(), this.events = [], this.thumbs = /* @__PURE__ */ new Map(), this.playing = !1, this._shown = 60;
	}
	get visible() {
		return [...this.events].reverse().slice(0, this._shown);
	}
	updated() {
		let e = this.visible.filter((e) => !this.thumbs.has(e.start)).map((e) => e.start);
		e.length && this.dispatchEvent(new CustomEvent("rv-thumbs-needed", {
			detail: { times: e },
			bubbles: !0,
			composed: !0
		}));
	}
	_row(e) {
		let t = this.thumbs.get(e.start), n = this.current !== void 0 && this.current >= e.start && this.current < e.end, r = Va(e.types), i = K(e.start, this.timeZone, !0);
		return O`<li>
      <button
        class="row ${n ? "active" : ""}"
        aria-current=${n ? "true" : "false"}
        aria-label="${r}, ${i}${n ? this.playing ? ", playing" : ", selected" : ""}: play"
        @click=${() => {
			this.dispatchEvent(new CustomEvent("rv-pick", {
				detail: { event: e },
				bubbles: !0,
				composed: !0
			}));
		}}
      >
        <span class="t">${i.slice(0, -3)}<small>${i.slice(-3)}</small></span>
        <span class="ev">
          ${P(Ha(e.types))}<span class="label">${r}</span>
        </span>
        <span class="meta">
          ${n ? O`<span class="tag">${this.playing ? "Playing" : "Selected"}</span>` : A}
          <span>${Ua(e.end - e.start)}</span>
          ${e.ambiguous ? O`<span title="Recorded in the hour repeated when clocks went back">time ±1 h</span>` : A}
        </span>
        <span class="thumb">${t ? O`<img src=${t} alt="" loading="lazy" decoding="async" />` : A}</span>
      </button>
    </li>`;
	}
	render() {
		if (!this.events.length) return O`<p class="muted empty">No events for the chosen kinds.</p>`;
		let e = this.events.length - this._shown;
		return O`<ol>
        ${this.visible.map((e) => this._row(e))}
      </ol>
      ${e > 0 ? O`<button class="text more" @click=${() => {
			this._shown += 60;
		}}>Show ${Math.min(e, 60)} more (${e} left)</button>` : A}`;
	}
	static styles = [F, o`
      :host {
        display: block;
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule-strong);
      }
      li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .row {
        display: grid;
        grid-template-columns: 70px minmax(0, 1fr) 84px;
        grid-template-areas: "t ev thumb" "t meta thumb";
        column-gap: 12px;
        align-items: center;
        width: 100%;
        min-height: 62px;
        padding: 7px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .row:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .row:focus-visible {
        outline-offset: -2px;
      }
      .row.active {
        background: var(--rv-ground-2);
      }
      .t {
        grid-area: t;
        font-family: var(--rv-font-cond);
        font-size: 24px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
      }
      .t small {
        margin-left: 1px;
        color: var(--rv-muted);
        font-size: 14px;
        font-weight: 500;
      }
      .ev {
        grid-area: ev;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        font-size: 15px;
        font-weight: 500;
      }
      .ev svg {
        flex: none;
        width: 18px;
        height: 18px;
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta {
        grid-area: meta;
        display: flex;
        flex-wrap: wrap;
        gap: 0 10px;
        color: var(--rv-muted);
        font-size: 14px;
      }
      .tag {
        color: var(--rv-text);
        font-weight: 600;
      }
      .thumb {
        grid-area: thumb;
        width: 84px;
        height: 47px;
        background: var(--rv-ground-2);
        overflow: hidden;
      }
      .thumb img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .more {
        margin-top: 8px;
        padding-left: 0;
      }
      .empty {
        margin: 10px 0;
      }
    `];
};
customElements.get("rv-event-list") || customElements.define("rv-event-list", Wa);
//#endregion
//#region src/playback/player.ts
var Ga = [
	.5,
	1,
	2,
	4,
	8
], Ka = class extends M {
	static properties = {
		muted: { type: Boolean },
		rate: { type: Number },
		note: { attribute: !1 },
		_active: { state: !0 },
		_paused: { state: !0 },
		_waiting: { state: !0 },
		_started: { state: !0 }
	};
	_items = [void 0, void 0];
	_keys = [void 0, void 0];
	_feeders = [void 0, void 0];
	_requestedAt;
	_firstOnSeeked = !1;
	_endedAt;
	_pendingOffset = [0, 0];
	constructor() {
		super(), this.muted = !0, this.rate = 1, this._active = 0, this._paused = !0, this._waiting = !1, this._started = !1;
	}
	updated(e) {
		if (e.has("rate")) for (let e of [0, 1]) this._applyRate(this._video(e));
	}
	get mseStats() {
		let e = this._feeders[this._active];
		return e ? {
			...e.stats,
			...e.around
		} : void 0;
	}
	get mse() {
		let e = this._feeders[this._active];
		return e !== void 0 && !e.closed;
	}
	get current() {
		return this._items[this._active];
	}
	get preloaded() {
		return this._items[this._other];
	}
	get time() {
		let e = this.current, t = this._video(this._active);
		return e && t ? e.start + t.currentTime * 1e3 : void 0;
	}
	get paused() {
		return this._paused;
	}
	get _other() {
		return +(this._active === 0);
	}
	_video(e) {
		return this.renderRoot.querySelector(`video[data-slot="${e}"]`);
	}
	async play(e, t = 0, n = performance.now()) {
		await this.updateComplete, this._started = !0, this._requestedAt = n, this._firstOnSeeked = !1, this._endedAt = void 0;
		let r = this.preloaded?.recording === e.recording;
		r && (this._video(this._active)?.pause(), this._active = this._other);
		let i = this._active, a = this._video(i);
		a && (this._pendingOffset[i] = t, r ? this._seekTo(a, t) : (this._setItem(i, e), this._load(i, a, e, t)), this._start(a), this.requestUpdate());
	}
	async preload(e) {
		await this.updateComplete;
		let t = this._other, n = this._video(t);
		!n || this._items[t]?.recording === e?.recording ? e && e !== this._items[t] && e.release?.() : (this._setItem(t, e), this._pendingOffset[t] = 0, n.pause(), e ? (n.preload = "auto", this._load(t, n, e, 0)) : this._unload(t, n));
	}
	seek(e) {
		let t = this._video(this._active);
		t && this._seekTo(t, e);
	}
	seekWithin(e, t = performance.now()) {
		let n = this._video(this._active);
		n && (this._requestedAt = t, this._firstOnSeeked = !0, this._seekTo(n, e), this._start(n));
	}
	preview(e) {
		let t = this.current, n = this._video(this._active);
		if (!t || !n || e < t.start || e > t.end) return !1;
		let r = (e - t.start) / 1e3, i = n.buffered;
		for (let e = 0; e < i.length; e += 1) if (r >= i.start(e) && r <= i.end(e)) return typeof n.fastSeek == "function" ? n.fastSeek(r) : n.currentTime = r, !0;
		return !1;
	}
	pause() {
		this._video(this._active)?.pause();
	}
	resume() {
		let e = this._video(this._active);
		e && this._start(e);
	}
	stop() {
		for (let e of [0, 1]) {
			let t = this._video(e);
			t?.pause(), t && this._unload(e, t), this._setItem(e, void 0);
		}
		this._paused = !0, this._waiting = !1;
	}
	_setItem(e, t) {
		let n = this._items[e];
		this._items[e] = t, n && n !== t && !this._items.includes(n) && n.release?.();
	}
	_load(e, t, n, r) {
		if (this._feeders[e]?.destroy(), this._feeders[e] = void 0, this._keys[e] = n.key, n.mse) {
			let i = new Tn(t, n.mse, (t) => {
				this._feederFailed(e, n, t);
			});
			this._feeders[e] = i, i.start(r).catch((t) => {
				i.closed || this._feederFailed(e, n, t instanceof Error ? t : Error(String(t)));
			});
		} else n.url && (t.disableRemotePlayback = !1, t.setAttribute("src", n.url), t.load());
		this._applyRate(t);
	}
	_unload(e, t) {
		this._feeders[e]?.destroy(), this._feeders[e] = void 0, this._keys[e] = void 0, t.getAttribute("src") && (t.removeAttribute("src"), t.load());
	}
	_applyRate(e) {
		e && (e.defaultPlaybackRate = this.rate, e.playbackRate = this.rate);
	}
	_feederFailed(e, t, n) {
		if (this._items[e] !== t) return;
		if (e !== this._active) {
			this._setItem(e, void 0);
			let t = this._video(e);
			t && this._unload(e, t);
			return;
		}
		let r = this._video(e);
		r && this._fail(n.message, r, n instanceof mn);
	}
	_seekTo(e, t) {
		let n = Math.max(0, t / 1e3);
		e.readyState >= 1 ? e.currentTime = n : this._pendingOffset[Number(e.dataset.slot)] = t;
	}
	_start(e) {
		e.play()?.catch((t) => {
			t instanceof DOMException && t.name === "NotAllowedError" ? this._paused = !0 : t instanceof DOMException && t.name === "AbortError" || this._fail(String(t), e, !1);
		});
	}
	_fail(e, t, n) {
		let r = {
			message: e,
			segmentId: this.current?.segmentId,
			played: t.currentTime > 0,
			fallback: n
		};
		this.dispatchEvent(new CustomEvent("rv-player-error", {
			detail: r,
			bubbles: !0,
			composed: !0
		}));
	}
	_emit(e, t) {
		this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0
		}));
	}
	_onMetadata(e, t) {
		let n = t.target, r = this._pendingOffset[e];
		r > 0 && (n.currentTime = r / 1e3), this._pendingOffset[e] = 0;
	}
	_onPlaying(e) {
		if (e !== this._active) return;
		this._paused = !1, this._waiting = !1;
		let t = this.current;
		if (!t) return;
		let n = performance.now();
		if (this._endedAt !== void 0) {
			let e = {
				segmentId: t.segmentId,
				gapMs: n - this._endedAt
			};
			this._emit("rv-advanced", e), this._endedAt = void 0;
		} else if (this._requestedAt !== void 0) {
			let e = {
				segmentId: t.segmentId,
				ms: n - this._requestedAt
			};
			this._emit("rv-first-frame", e);
		}
		this._requestedAt = void 0;
	}
	_onSeeked(e) {
		if (e !== this._active) return;
		this._waiting = !1;
		let t = this.current;
		if (!this._firstOnSeeked || this._requestedAt === void 0 || !t) return;
		let n = {
			segmentId: t.segmentId,
			ms: performance.now() - this._requestedAt
		};
		this._emit("rv-first-frame", n), this._requestedAt = void 0, this._firstOnSeeked = !1;
	}
	_onEnded(e) {
		if (e !== this._active) return;
		let t = this.current;
		if (this._endedAt = performance.now(), this.preloaded) {
			this._setItem(e, void 0);
			let t = this._video(e);
			t && this._unload(e, t), this._active = this._other;
			let n = this._video(this._active);
			n && this._start(n);
		} else this._endedAt = void 0, this._paused = !0, this._emit("rv-ended", { segmentId: t?.segmentId });
	}
	_onTime(e) {
		if (e !== this._active) return;
		let t = this.time;
		t !== void 0 && this._emit("rv-time", { time: t });
	}
	_onError(e, t) {
		let n = t.target;
		if (!n.getAttribute("src")) return;
		if (e !== this._active) {
			this._setItem(e, void 0);
			return;
		}
		let r = this._feeders[e] !== void 0;
		this._fail(n.error?.message || `media error ${n.error?.code ?? "?"}`, n, r);
	}
	_renderVideo(e) {
		return O`<video
      data-slot=${e}
      class=${e === this._active ? "active" : "hidden"}
      playsinline
      .muted=${this.muted}
      ?controls=${e === this._active && this._started}
      preload="auto"
      @loadedmetadata=${(t) => {
			this._onMetadata(e, t);
		}}
      @playing=${() => {
			this._onPlaying(e);
		}}
      @seeked=${() => {
			this._onSeeked(e);
		}}
      @waiting=${() => {
			e === this._active && (this._waiting = !0);
		}}
      @pause=${() => {
			e === this._active && (this._paused = !0);
		}}
      @ended=${() => {
			this._onEnded(e);
		}}
      @timeupdate=${() => {
			this._onTime(e);
		}}
      @error=${(t) => {
			this._onError(e, t);
		}}
    ></video>`;
	}
	render() {
		let e = this._waiting || this._requestedAt !== void 0 && this.note ? this.note : void 0;
		return O`<div class="frame">
      ${this._renderVideo(0)}${this._renderVideo(1)}
      ${e ? O`<div class="note" role="status">${e}</div>` : A}
      ${this._started ? A : O`<p class="empty">Pick an event or a time on the timeline to play it.</p>`}
    </div>`;
	}
	static styles = o`
    :host {
      display: block;
    }
    .frame {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: var(--rv-board, #000);
      overflow: hidden;
    }
    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: var(--rv-board, #000);
    }
    .note {
      position: absolute;
      left: 50%;
      bottom: 48px;
      transform: translateX(-50%);
      max-width: calc(100% - 32px);
      padding: 6px 12px;
      background: rgba(17, 20, 24, 0.82);
      color: var(--rv-on-board, #fff);
      font-family: var(--rv-font, sans-serif);
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      pointer-events: none;
    }
    .empty {
      position: absolute;
      inset: 0;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 16px;
      color: var(--rv-on-board-muted, #a9b0c4);
      font-family: var(--rv-font, sans-serif);
      font-size: 15px;
      text-align: center;
    }
    /* The hidden buffer stays laid out (some browsers do not load hidden video). */
    video.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
};
customElements.get("rv-player") || customElements.define("rv-player", Ka);
//#endregion
//#region src/playback/thumb-loader.ts
var qa = class {
	_concurrency;
	_create;
	_queue = [];
	_active = /* @__PURE__ */ new Set();
	_paused = !1;
	constructor(e = 2, t = () => new Image()) {
		this._concurrency = e, this._create = t;
	}
	load(e) {
		return new Promise((t) => {
			this._queue.push({
				url: e,
				resolve: t
			}), this._pump();
		});
	}
	pause() {
		this._paused = !0;
	}
	resume() {
		this._paused = !1, this._pump();
	}
	clear() {
		for (let e of this._queue.splice(0)) e.resolve(!1);
		for (let { job: e, image: t } of this._active) t.onload = t.onerror = null, t.src = "", e.resolve(!1);
		this._active.clear();
	}
	get pending() {
		return this._queue.length + this._active.size;
	}
	_pump() {
		for (; !this._paused && this._active.size < this._concurrency;) {
			let e = this._queue.shift();
			if (!e) return;
			let t = this._create(), n = {
				job: e,
				image: t
			}, r = (t) => {
				this._active.delete(n) && (e.resolve(t), this._pump());
			};
			t.onload = () => {
				r(!0);
			}, t.onerror = () => {
				r(!1);
			}, this._active.add(n), t.src = e.url;
		}
	}
}, Ja = 4, Ya = 76, Xa = 18, Za = 22, Qa = 26, $a = 52, eo = 16, to = class extends M {
	static properties = {
		day: { attribute: !1 },
		events: { attribute: !1 },
		view: { attribute: !1 },
		cursor: { attribute: !1 },
		timeZone: { attribute: !1 }
	};
	_width = 0;
	_resize;
	_drag;
	_hoverTimer;
	constructor() {
		super(), this.events = [], this.view = {
			start: 0,
			span: $[0] ?? 864e5
		};
	}
	connectedCallback() {
		super.connectedCallback(), typeof ResizeObserver < "u" && (this._resize = new ResizeObserver(() => {
			this._draw();
		}), this._resize.observe(this));
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._resize?.disconnect(), clearTimeout(this._hoverTimer);
	}
	get _canvas() {
		return this.renderRoot.querySelector("canvas");
	}
	get _bounds() {
		let e = this.day;
		return e ? {
			start: e.start,
			end: e.end
		} : {
			start: this.view.start,
			end: this.view.start + this.view.span
		};
	}
	timeAt(e) {
		return aa(e, this.view, this._width || 1);
	}
	updated() {
		this._draw();
	}
	_emit(e, t) {
		this.dispatchEvent(new CustomEvent(e, {
			detail: t,
			bubbles: !0,
			composed: !0
		}));
	}
	_setView(e) {
		let t = oa(e, this._bounds);
		(t.start !== this.view.start || t.span !== this.view.span) && this._emit("rv-view-change", { view: t });
	}
	zoom(e, t) {
		let n = $[Math.min(Math.max(ca(this.view.span) + e, 0), $.length - 1)] ?? this.view.span, r = t ?? this.cursor ?? this.view.start + this.view.span / 2;
		this._setView(sa(this.view, n, r, this._bounds));
	}
	pan(e) {
		this._setView({
			start: this.view.start + e * this.view.span,
			span: this.view.span
		});
	}
	_x(e) {
		let t = this._canvas?.getBoundingClientRect();
		return e.clientX - (t?.left ?? 0);
	}
	_onWheel(e) {
		if (e.preventDefault(), e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
			let t = e.shiftKey ? e.deltaY : e.deltaX;
			this.pan(Math.sign(t) * .25);
		} else e.deltaY !== 0 && this.zoom(e.deltaY < 0 ? 1 : -1, this.timeAt(this._x(e)));
	}
	_onPointerDown(e) {
		e.button === 0 && (this._drag = {
			pointerId: e.pointerId,
			x: this._x(e),
			moved: !1
		}, no(this._canvas, e.pointerId, !0));
	}
	_onPointerMove(e) {
		let t = this._x(e), n = this._drag;
		if (n && n.pointerId === e.pointerId) {
			if (Math.abs(t - n.x) > Ja && (n.moved = !0), n.moved) {
				let e = this.timeAt(t);
				this._emit("rv-scrub", { time: e }), this._scheduleHover(e, t);
			}
		} else e.pointerType === "mouse" && this._scheduleHover(this.timeAt(t), t);
	}
	_onPointerUp(e) {
		let t = this._drag;
		t && t.pointerId === e.pointerId && (this._drag = void 0, no(this._canvas, e.pointerId, !1), this._emit("rv-seek", { time: this.timeAt(this._x(e)) }), e.pointerType !== "mouse" && this._endHover());
	}
	_scheduleHover(e, t) {
		clearTimeout(this._hoverTimer), this._hoverTimer = setTimeout(() => {
			this._emit("rv-hover", {
				time: e,
				x: t
			});
		}, 150);
	}
	_endHover() {
		clearTimeout(this._hoverTimer), this._emit("rv-hover-end", {});
	}
	_onKey(e) {
		let t = {
			ArrowLeft: () => {
				this.pan(-.25);
			},
			ArrowRight: () => {
				this.pan(.25);
			},
			"+": () => {
				this.zoom(1);
			},
			"=": () => {
				this.zoom(1);
			},
			"-": () => {
				this.zoom(-1);
			}
		}[e.key];
		t && (e.preventDefault(), t());
	}
	_draw() {
		let e = this._canvas;
		if (!e) return;
		let t = Math.max(1, Math.round(this.getBoundingClientRect().width || e.clientWidth || 300));
		this._width = t;
		let n = window.devicePixelRatio || 1;
		e.width !== t * n && (e.width = t * n, e.height = Ya * n);
		let r = e.getContext("2d");
		if (!r) return;
		r.setTransform(n, 0, 0, n, 0, 0);
		let i = getComputedStyle(this), a = (e, t) => i.getPropertyValue(e).trim() || t, o = a("--rv-text", "#111418"), s = a("--rv-muted", "#5d6370");
		r.clearRect(0, 0, t, Ya);
		let c = this.view, l = (e) => ia(e, c, t);
		r.font = `500 12px ${a("--rv-font", "sans-serif")}`, r.textBaseline = "top", r.fillStyle = s, r.strokeStyle = a("--rv-rule", "#e0e0e0"), r.lineWidth = 1;
		let u = this.timeZone, d = da(c, t) < Z;
		for (let e of fa(c, t, (e) => Wn(e, u))) {
			let n = Math.round(l(e)) + .5;
			r.beginPath(), r.moveTo(n, 14), r.lineTo(n, Ya), r.stroke();
			let i = K(e, u, d);
			n + 3 + r.measureText(i).width <= t && r.fillText(i, n + 3, 2);
		}
		let f = this.day;
		if (f) {
			if (f.now < f.end) {
				r.fillStyle = a("--rv-ground-2", "#f2f2f2");
				let e = Math.max(0, l(f.now));
				r.fillRect(e, Za, t - e, 54);
			}
			r.fillStyle = a("--rv-recording", "#1b2a6e");
			for (let e of pa(f.segments, c, t)) {
				let n = Math.max(0, l(e.start)), i = Math.min(t, l(e.end));
				r.fillRect(n, Za, Math.max(1, i - n), Qa);
			}
			r.fillStyle = o;
			for (let e of this.events) {
				if (e.end < c.start || e.start > c.start + c.span) continue;
				let t = l(e.start), n = Math.max(3, l(e.end) - t);
				r.fillRect(t, $a, n, eo);
			}
			f.now < f.end && f.now >= c.start && f.now <= c.start + c.span && (r.fillStyle = a("--rv-red", "#e10600"), r.fillRect(Math.round(l(f.now)) - 1, Xa, 2, 58));
		}
		if (this.cursor !== void 0) {
			let e = Math.round(l(this.cursor));
			r.fillStyle = o, r.fillRect(e - 1, Xa, 2, 58), r.beginPath(), r.moveTo(e - 6, 14), r.lineTo(e + 6, 14), r.lineTo(e, 21), r.closePath(), r.fill();
		}
	}
	render() {
		return O`<canvas
      role="slider"
      tabindex="0"
      aria-label="Recording timeline"
      aria-valuemin=${this.day?.start ?? 0}
      aria-valuemax=${this.day?.end ?? 0}
      aria-valuenow=${this.cursor ?? 0}
      aria-valuetext=${this.cursor === void 0 ? "no position" : K(this.cursor, this.timeZone, !0)}
      @wheel=${(e) => {
			this._onWheel(e);
		}}
      @pointerdown=${(e) => {
			this._onPointerDown(e);
		}}
      @pointermove=${(e) => {
			this._onPointerMove(e);
		}}
      @pointerup=${(e) => {
			this._onPointerUp(e);
		}}
      @pointercancel=${() => {
			this._drag = void 0, this._endHover();
		}}
      @pointerleave=${(e) => {
			!this._drag && e.pointerType === "mouse" && this._endHover();
		}}
      @keydown=${(e) => {
			this._onKey(e);
		}}
    ></canvas>`;
	}
	static styles = o`
    :host {
      display: block;
      position: relative;
    }
    canvas {
      display: block;
      width: 100%;
      height: ${Ya}px;
      touch-action: pan-y;
      cursor: pointer;
      border-bottom: 1px solid var(--rv-rule-strong);
    }
    canvas:focus-visible {
      outline: 2px solid var(--rv-action);
      outline-offset: 2px;
    }
  `;
};
function no(e, t, n) {
	try {
		n ? e?.setPointerCapture(t) : e?.releasePointerCapture(t);
	} catch {}
}
customElements.get("rv-timeline") || customElements.define("rv-timeline", to);
//#endregion
//#region src/live/check.ts
var ro = "0.22.0", io = "Live check · ", ao = [
	"Desktop Chrome, LAN",
	"Desktop Chrome, Tailscale",
	"Desktop Chrome, Nabu Casa",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
], oo = 2e4, so = 12e3, co = 1e4, lo = 2e3, uo = 15e3, fo = 1e3, po = 1e4, mo = class extends Error {}, ho = 2e3, go = 4e3, _o = (e) => new Promise((t) => setTimeout(t, e)), vo = class {
	_hass;
	options;
	_stage;
	_onChange;
	id;
	lines = [];
	running = !1;
	status = "";
	plainStatus = "";
	afterFrameMs = 300;
	_stopped = !1;
	_session;
	_lastSave = 0;
	_saving = Promise.resolve();
	_ice = [];
	_measured = [];
	_posters = [];
	_capacity = [];
	_chosen = [];
	constructor(e, t, n, r = () => void 0) {
		this._hass = e, this.options = t, this._stage = n, this._onChange = r, this.id = `live-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19)}-${Math.random().toString(36).slice(2, 6)}`;
	}
	get text() {
		return this.lines.join("\n");
	}
	stop() {
		this._stopped = !0, this._session?.close();
	}
	async run() {
		this.running = !0;
		try {
			this.plainStatus = "Getting ready", await this._header();
			let e = await this._cameras();
			this._chosen = e, this.plainStatus = "Loading a still picture of each camera", await this._ourImages(e), await this._hdChoices(e);
			for (let [t, n] of e.entries()) {
				this.plainStatus = `Measuring ${n.name}, camera ${String(t + 1)} of ${String(e.length)}`;
				for (let e of n.connections) for (let t of this.options.streams) await this._measureStream(n, e, t);
			}
			this.options.capacity && (this.plainStatus = "Testing how many streams each NVR serves at once", await this._capacityTests()), this._summary(e);
		} catch (e) {
			this._log(e instanceof mo ? "Stopped." : `Check failed: ${N(e).message}`);
		} finally {
			this._session?.close(), await this._go2rtcLog(), this.running = !1, this.status = "", this.plainStatus = "", this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0);
		}
		return this.text;
	}
	async _go2rtcLog() {
		let e = (await nt(this._hass).catch(() => void 0))?.go2rtc.log;
		if (e?.length) {
			this._log(""), this._log(`go2rtc log (last ${String(e.length)} lines):`);
			for (let t of e) this._log(`  ${t}`);
		}
	}
	_log(e) {
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > po && this._save(!1);
	}
	_status(e) {
		this.status = e, this._onChange();
	}
	_save(e) {
		return this._lastSave = performance.now(), this._saving = this._saving.then(() => this._hass.callWS({
			type: "reolink_viewer/playback/check_report",
			report_id: this.id,
			setup: `${io}${this.options.setup}`,
			text: this.text,
			done: e
		})).then(() => void 0).catch(() => void 0), this._saving;
	}
	_checkStopped() {
		if (this._stopped) throw new mo();
	}
	async _header() {
		let e = this._hass.user?.is_admin === !0;
		this._log(`Reolink Viewer live check v${ro} · ${this.options.setup} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${Zr(navigator.userAgent)} · page ${qr(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x`), this._log(`User agent: ${navigator.userAgent}`);
		let t = G(), n = t ? window[t] : void 0;
		this._log(`MSE: ${t ?? "none"}${n ? `, takes ${Nt((e) => n.isTypeSupported(e)) || "none of go2rtc's codecs"}` : ""}`), this._log(`WebRTC receives: ${xo()}`);
		let r = await ft(this._hass).catch(() => []);
		this._ice = It(r), this._log(`ICE servers (Home Assistant's): ${Ft(r)}`);
		let i = this.options;
		this._log(`Streams: ${i.streams.join(", ")} · warm: ${i.warm && e ? "yes" : e ? "no" : "no (not an admin)"} · Home Assistant's view: ${i.stock ? "yes" : "no"} · capacity test: ${i.capacity && e ? "yes" : "no"}`);
		let a = performance.now(), o = (await nt(this._hass)).go2rtc;
		this._log(`go2rtc: ${o.state}${o.version ? ` ${o.version}` : ""}${o.binary ? ` (${o.binary === "system" ? "Home Assistant's binary" : "downloaded, checksum verified"})` : ""}${o.error ? ` · error: ${o.error}` : ""} · restarts ${o.restarts} · WebRTC port ${o.webrtc_port} · status in ${Math.round(performance.now() - a)} ms`);
	}
	async _cameras() {
		let { cameras: e } = await rt(this._hass), t = this.options.cameraIds?.length ? new Set(this.options.cameraIds) : void 0, n = e.filter((e) => !t || t.has(e.id));
		return this._log(`Cameras: ${n.map((e) => `${e.name}${e.connections.length > 1 ? ` (${e.connections.map((e) => e.via).join(" + ")})` : ""}`).join(", ")}`), n;
	}
	async _ourImages(e) {
		this._checkStopped(), this._status("our pictures");
		let t = /* @__PURE__ */ new Map(), n, r = () => void 0, i = performance.now(), a;
		this._log("");
		try {
			a = await ht(this._hass, (e) => {
				n ??= performance.now() - i;
				for (let [n, r] of Object.entries(e.images)) t.set(n, r);
				r();
			});
		} catch (e) {
			this._log(`First images (ours): failed (${N(e).message})`);
			return;
		}
		let o = () => new Promise((e) => {
			r = e, setTimeout(e, 100);
		});
		try {
			let r = i + uo;
			for (; n === void 0 && performance.now() < r;) await o();
			if (n === void 0) {
				this._log(`First images (ours): no list in ${R(uo)}`);
				return;
			}
			this._log(`First images (ours, kept on the server): listed in ${Math.round(n)} ms`);
			for (let r of e) {
				this._checkStopped();
				let e = performance.now();
				for (; !t.has(r.id) && performance.now() < e + uo;) await o();
				let i = t.get(r.id);
				if (!i) {
					this._log(`  ${r.name}: none in ${R(uo)}`);
					continue;
				}
				let a = performance.now() - e, s = await So(i.url);
				s.ms !== void 0 && this._posters.push({
					kind: "ours",
					ms: n + a + s.ms,
					cameraId: r.id
				});
				let c = Math.max(0, Date.now() - i.taken) / 1e3;
				this._log(`  ${r.name}: ${s.text}, taken ${c < 100 ? c.toFixed(1) : Math.round(c)} s before` + (a >= 50 ? ` (none kept: waited ${Math.round(a)} ms for it)` : ""));
			}
		} finally {
			await a().catch(() => void 0);
		}
	}
	async _hdChoices(e) {
		this._log(""), this._log("Full screen (HD), in this browser:");
		for (let t of e) {
			let e = z(t);
			e && this._log(`  ${t.name}: ${(await pn(e)).reason}`);
		}
	}
	async _measureStream(e, t, n) {
		this._checkStopped();
		let r = {
			connectionId: t.connection_id,
			stream: n
		}, i = t.streams[n], a = t.via === "nvr" ? `via ${t.entry_title}` : "direct";
		if (this._log(""), !i) {
			this._log(`${e.name}${e.model ? ` (${e.model})` : ""} · ${a} · ${n}: not served by this connection`);
			return;
		}
		this._log(`${e.name}${e.model ? ` (${e.model})` : ""} · ${a} · ${Bt(n, i.encoding)}`);
		let o = `${e.name} ${a} ${n}`, s = (r, i, a) => {
			this._measured.push({
				cameraId: e.id,
				camera: e.name,
				connection: t,
				stream: n,
				phase: r,
				transport: i,
				result: a
			});
		}, c = [], l = (e.keep_warm_entity ? this._hass.states[e.keep_warm_entity]?.state === "on" : !1) && n === "sub" && z(e) === t, u = l ? "kept warm by its switch; turn it off to measure cold" : "a viewer kept it running";
		for (let e of ["WebRTC", "MSE"]) {
			this._status(`${o}: cold ${e}`);
			let t = !l && await this._waitCold(r), n = await this._session_(e, r, oo);
			s("cold", e, n), c.push(`${e} ${yo(n)}${t ? "" : ` (${u}: not cold)`}`), e === "MSE" && c.push(...await this._videoOnly(n, r, oo, o));
		}
		if (this._log(`  cold: ${c.join(" · ")}`), this.options.stock) {
			let e = i.entity_id;
			if (!e) this._log(`  Home Assistant's view: no enabled camera entity for ${n}`);
			else {
				this._status(`${o}: Home Assistant's view`);
				let t = await this._stockPoster(e), n = await this._stock(e);
				s("stock", "WebRTC", n), this._log(`  Home Assistant's view (${e}): snapshot ${t} · WebRTC ${yo(n)}`);
			}
		}
		if (this.options.warm && this._hass.user?.is_admin) {
			if (t.is_battery) {
				this._log("  warm: not measured (battery camera: never kept warm)");
				return;
			}
			this._status(`${o}: keeping it warm`);
			let e = performance.now(), n;
			try {
				({key_frame: n} = await dt(this._hass, r, !0));
			} catch (e) {
				this._log(`  warm: keeping it warm failed: ${N(e).message}`);
				return;
			}
			let i = performance.now() - e;
			try {
				await this._pause(lo);
				let e = await this._frame(r), t = [];
				for (let e of ["WebRTC", "MSE"]) {
					this._status(`${o}: warm ${e}`);
					let n = await this._session_(e, r, so);
					s("warm", e, n), t.push(`${e} ${yo(n)}`), e === "MSE" && t.push(...await this._videoOnly(n, r, so, o));
				}
				let a = (await st(this._hass, r).catch(() => void 0))?.cache, c = n ? `key frame cached in ${R(i)}` : `no key frame in ${R(i)}`;
				this._log(`  warm (${c}${zt(a)}): frame ${e} · ${t.join(" · ")}`);
			} finally {
				await dt(this._hass, r, !1).catch(() => void 0);
			}
		}
	}
	async _waitCold(e) {
		let t = performance.now() + co;
		for (; performance.now() < t;) {
			if (this._checkStopped(), !(await st(this._hass, e).catch(() => void 0))?.state?.active) return !0;
			await _o(250);
		}
		return !1;
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await _o(Math.min(250, t - performance.now()));
	}
	async _session_(e, t, n) {
		return this._watch((r) => e === "WebRTC" ? new Nn(this._hass, r, t, this._ice, n) : new Fn(this._hass, r, t, n));
	}
	async _videoOnly(e, t, n, r) {
		return !e.ok || e.firstFrameMs === void 0 || !("appended" in e.steps) || e.firstFrameMs - e.steps.appended <= fo ? [] : (this._status(`${r}: MSE video only`), [`MSE video only ${yo(await this._watch((e) => new Fn(this._hass, e, t, n, location.href, !0)))}`]);
	}
	_stock(e) {
		return this._watch((t) => new Pn(this._hass, t, e, oo));
	}
	async _watch(e) {
		this._checkStopped();
		let t = document.createElement("video");
		this._stage.replaceChildren(t);
		let n = e(t);
		this._session = n;
		try {
			let e = await n.done;
			return e.ok && await _o(this.afterFrameMs), e;
		} finally {
			n.close(), this._session = void 0, t.remove();
		}
	}
	async _stockPoster(e) {
		let t = this._hass.states[e]?.attributes.entity_picture;
		if (typeof t != "string") return "no picture";
		let n = await So(`${t}${t.includes("?") ? "&" : "?"}_=${Date.now()}`);
		return n.ms !== void 0 && this._posters.push({
			kind: "HA snapshot",
			ms: n.ms
		}), n.text;
	}
	async _frame(e) {
		try {
			let { path: t } = await ot(this._hass, e), n = await So(t);
			return n.ms !== void 0 && this._posters.push({
				kind: "go2rtc frame",
				ms: n.ms
			}), n.text;
		} catch (e) {
			return `failed (${N(e).message})`;
		}
	}
	async _capacityTests() {
		if (!this._hass.user?.is_admin) {
			this._log(""), this._log("Capacity test: not run (admins only).");
			return;
		}
		let e = await Fe(this._hass);
		for (let t of e.hosts) {
			this._checkStopped();
			let e = t.name ?? t.id;
			this._log(""), this._log(`Capacity test: ${e} (sub streams one by one, then a main, then a recording download)`), this._status(`capacity test: ${e}`);
			let n = await this._capacity_(t.id, (t) => {
				this._status(`capacity test: ${e}: ${t}`);
			});
			if (typeof n == "string") this._log(`  failed: ${n}`);
			else {
				this._capacity.push({
					host: e,
					report: n
				});
				for (let e of Vt(n)) this._log(e);
			}
		}
	}
	_capacity_(e, t) {
		return new Promise((n) => {
			let r, i = !1, a = (e) => {
				i || (i = !0, r?.().catch(() => void 0), n(e));
			};
			gt(this._hass, e, (e) => {
				e.type === "progress" ? t(e.message) : e.type === "result" ? a(e.report) : a(e.message);
			}).then((e) => {
				r = e, i && e().catch(() => void 0);
			}).catch((e) => {
				a(N(e).message);
			});
		});
	}
	inShort(e = !this.running) {
		let t = [], n = [], r = [], i = 0, a = 0, o = (e) => {
			let t = e.filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0);
			return t.length ? Math.min(...t) : void 0;
		};
		for (let e of this._chosen) {
			let s = z(e), c = this._measured.filter((t) => t.cameraId === e.id && t.connection === s), l = c.filter((e) => e.phase === "cold");
			if (!l.length) continue;
			i += 1;
			let u = l.filter((e) => e.stream === "sub"), d = o(u.length ? u : l);
			if (d === void 0) {
				a += 1, t.push({
					grade: "problem",
					text: `${e.name}: live video did not start.`,
					advice: "Check that the camera is online (for example in the Reolink app), then run the check again."
				});
				continue;
			}
			n.push(d);
			let f = u.length ? o(l.filter((e) => e.stream !== "sub")) : void 0, p = o(c.filter((e) => e.phase === "warm" && e.stream === "sub")), m = V(d, ho, go);
			m === "slow" && r.push(e.name);
			let h = [`live video starts in ${B(d)}`];
			f !== void 0 && h.push(`full screen in HD in ${B(f)}`), p !== void 0 && h.push(`kept warm, in ${B(p)}`);
			let g;
			m !== "good" && s?.is_battery ? g = "Battery cameras wake up before they stream, so a few seconds is normal." : m !== "good" && e.keep_warm_entity && this._hass.states[e.keep_warm_entity]?.state !== "on" && (g = "Turn on its “keep live view warm” switch in Home Assistant to make it start faster" + (p === void 0 ? "." : ` (about ${B(p)} here).`)), t.push({
				grade: m,
				text: `${e.name}: ${h.join("; ")}.`,
				...g ? { advice: g } : {}
			});
		}
		let s = Xt(this._posters.filter((e) => e.kind === "ours").map((e) => e.ms));
		s !== void 0 && t.push({
			grade: V(s, 1e3, 2500),
			text: `A still picture of each camera shows in ${s < 100 ? "" : "about "}${B(s)}, while its live video starts.`
		});
		let c = this._measured.filter((e) => e.phase === "stock"), l = [];
		for (let e of c) {
			let t = o(this._measured.filter((t) => t.connection === e.connection && t.stream === e.stream && t.phase !== "stock"));
			t !== void 0 && e.result.ok && l.push([t, e.result.firstFrameMs ?? 0]);
		}
		if (l.length) {
			let e = l.filter(([e, t]) => e < t).length, n = Xt(l.map(([e]) => e)) ?? 0, r = Xt(l.map(([, e]) => e)) ?? 0;
			t.push({
				grade: "note",
				text: `Compared with Home Assistant's own camera view: this viewer was quicker on ${String(e)} of ${H(l.length, "stream")} (typically ${B(n)} against ${B(r)}).`
			});
		}
		let u = this._measured.filter((e) => e.transport === "WebRTC" && e.phase !== "stock"), d = this._measured.some((e) => e.transport === "MSE" && e.result.ok);
		u.length && !u.some((e) => "connected" in e.result.steps) && d && t.push({
			grade: "note",
			text: "WebRTC could not connect from this device, so live video used the viewer's other way of streaming (MSE), which worked."
		});
		for (let { host: e, report: n } of this._capacity) {
			let r = n.verdict.first_failing_level;
			if (r === null) {
				let r = Math.max(0, ...n.levels.map((e) => e.streams.length));
				t.push({
					grade: "good",
					text: `${e} kept up with ${H(r, "video stream")} at once.`
				});
			} else {
				let i = n.levels.find((e) => e.level === r)?.streams.length;
				t.push({
					grade: "slow",
					text: `${e} struggled with ${i === void 0 ? "several streams" : H(i, "video stream")} at once.`,
					advice: "Keep fewer of its cameras warm, or watch fewer of them in full screen at the same time."
				});
			}
		}
		let f = Xt(n), p = i - a, m = a ? `${String(p)} of ${H(i, "camera")} started live video; ${String(a)} did not` : `${i === 1 ? "The camera" : i === 2 ? "Both cameras" : `All ${H(i, "camera")}`} started live video` + (f === void 0 ? "" : `, typically in ${B(f)}`), h = r.length ? `; ${String(r.length)} ${r.length === 1 ? "is" : "are"} slow: ${r.join(", ")}` : "";
		return {
			headline: i ? `${e ? "" : "So far: "}${m}${h}.` : e ? "No camera was measured." : "Measuring…",
			findings: t
		};
	}
	_summary(e) {
		let t = this._measured;
		this._log("");
		for (let e of Zt(this.inShort(!0))) this._log(e);
		this._log(""), this._log("Summary:");
		let n = t.filter((e) => e.transport === "WebRTC" && e.phase !== "stock"), r = n.filter((e) => "connected" in e.result.steps), i = bo(r.map((e) => `${e.result.pair?.local ?? "?"} ↔ ${e.result.pair?.remote ?? "?"}`));
		this._log(`- WebRTC connected ${r.length} of ${n.length} sessions${i ? ` (${i})` : ""}`);
		for (let e of ["cold", "warm"]) for (let n of ["WebRTC", "MSE"]) for (let r of [["sub"], ["main", "ext"]]) {
			let i = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0), a = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).length;
			a && this._log(`- ${e} ${n}, ${r.join("/")}: median ${R(Rt(i))}, ${i.length} of ${a} played` + (i.length ? ` (${R(Math.min(...i))}–${R(Math.max(...i))})` : ""));
		}
		let a = t.filter((e) => e.phase === "stock");
		if (a.length) {
			let e = 0, n = 0;
			for (let r of a) {
				let i = t.filter((e) => e.connection === r.connection && e.stream === r.stream && e.phase !== "stock" && e.result.ok), a = i.length ? Math.min(...i.map((e) => e.result.firstFrameMs ?? Infinity)) : void 0;
				a !== void 0 && r.result.ok && (n += 1, a < (r.result.firstFrameMs ?? Infinity) && (e += 1));
			}
			let r = a.filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0);
			this._log(`- Home Assistant's view: median ${R(Rt(r))}, ${r.length} of ${a.length} played; ours (best of cold/warm) faster on ${e} of ${n}`);
		}
		for (let e of [
			"ours",
			"HA snapshot",
			"go2rtc frame"
		]) {
			let t = this._posters.filter((t) => t.kind === e).map((e) => e.ms);
			t.length && this._log(`- first image, ${e}: median ${R(Rt(t))} (${t.length}), slowest ${R(Math.max(...t))}`);
		}
		for (let n of e.filter((e) => e.connections.length > 1)) {
			let e = n.connections.map((e) => {
				let n = Rt(t.filter((t) => t.connection === e && t.stream === "sub" && t.phase === "cold" && t.result.ok).map((e) => e.result.firstFrameMs ?? 0));
				return `${e.via === "nvr" ? "via NVR" : "direct"} cold sub ${R(n)}`;
			});
			this._log(`- ${n.name}: ${e.join(" vs ")}`);
		}
		for (let { host: e, report: t } of this._capacity) {
			let n = t.verdict;
			this._log(`- capacity ${e}: ${n.first_failing_level === null ? `kept up at every level (${t.levels.length})` : `level ${n.first_failing_level} fails or slows down (${n.reasons.join("; ")})`}`);
		}
	}
};
function yo(e) {
	let t = Object.entries(e.steps).filter(([e]) => [
		"answer",
		"connected",
		"url",
		"open",
		"mime",
		"first data",
		"appended"
	].includes(e)).sort(([, e], [, t]) => e - t).map(([e, t]) => `${e} ${t} ms`), n = e.pair, r = n?.local ? `${n.local} ↔ ${n.remote ?? "?"}${n.rttMs === void 0 ? "" : `, rtt ${n.rttMs} ms`}` : void 0, i = [n?.codec ?? e.mse?.mime.replace(/^video\/mp4; codecs=/, "").replace(/"/g, ""), e.width ? `${e.width}×${e.height}` : void 0].filter(Boolean).join(" "), a = [
		t.join(", "),
		r,
		i
	].filter(Boolean).join("; ");
	return e.ok ? `${R(e.firstFrameMs)}${a ? ` (${a})` : ""}` : `✗ ${e.error ?? "failed"}${a ? ` (${a})` : ""}`;
}
function bo(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.set(n, (t.get(n) ?? 0) + 1);
	return [...t].map(([e, t]) => `${t}× ${e}`).join(", ");
}
function xo() {
	let e = typeof RTCRtpReceiver < "u" ? RTCRtpReceiver.getCapabilities("video") : null;
	return e ? [...new Set(e.codecs.map((e) => e.mimeType.replace(/^video\//, "")).filter((e) => !/rtx|red|ulpfec|flexfec/i.test(e)))].join(", ") : "unknown";
}
function So(e) {
	return new Promise((t) => {
		let n = performance.now(), r = new Image(), i = setTimeout(() => {
			t({ text: "timed out" });
		}, uo);
		r.onload = () => {
			clearTimeout(i);
			let e = performance.now() - n;
			t({
				ms: e,
				text: `${Math.round(e)} ms (${r.naturalWidth}×${r.naturalHeight})`
			});
		}, r.onerror = () => {
			clearTimeout(i), t({ text: "failed" });
		}, r.src = e;
	});
}
//#endregion
//#region src/components/events-view.ts
var Co = class extends M {
	static properties = {
		hass: { attribute: !1 },
		cameras: { attribute: !1 },
		date: { attribute: !1 },
		_feed: { state: !0 },
		_calendar: { state: !0 },
		_month: { state: !0 },
		_days: { state: !0 },
		_daysLoading: { state: !0 },
		_cameraFilter: { state: !0 },
		_typeFilter: { state: !0 }
	};
	_monthSeq = 0;
	constructor() {
		super(), this.cameras = [], this._calendar = !1, this._days = /* @__PURE__ */ new Set(), this._daysLoading = !1, this._cameraFilter = /* @__PURE__ */ new Set(), this._typeFilter = /* @__PURE__ */ new Set();
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return Un(Date.now(), this._zone);
	}
	get _day() {
		return this.date ?? this._today;
	}
	willUpdate(e) {
		if (e.has("date") && (this._feed = void 0), (e.has("date") || e.has("hass")) && this.hass) {
			let [e, t] = this._day.split("-").map(Number);
			e && t && (this._month?.year !== e || this._month.month !== t) && this._loadMonth(e, t);
		}
	}
	async _loadMonth(e, t) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._monthSeq;
		this._month = {
			year: e,
			month: t
		}, this._daysLoading = !0;
		try {
			let { days: i } = await We(n, e, t);
			r === this._monthSeq && (this._days = new Set(i));
		} catch {
			r === this._monthSeq && (this._days = /* @__PURE__ */ new Set());
		} finally {
			r === this._monthSeq && (this._daysLoading = !1);
		}
	}
	_go(e) {
		this._calendar = !1, I(this, e >= this._today ? { view: "events" } : {
			view: "events",
			date: e
		});
	}
	_shift(e) {
		let [t, n, r] = this._day.split("-").map(Number);
		t && n && r && this._go(new Date(Date.UTC(t, n - 1, r + e)).toISOString().slice(0, 10));
	}
	_toggle(e, t) {
		let n = new Set(e);
		return n.delete(t) || n.add(t), n;
	}
	render() {
		let e = this._day, t = e === this._today, n = wo(e);
		return O`<div class="head">
        <h1>Events</h1>
        <div class="day-nav" role="group" aria-label="Day">
          <button class="step" aria-label="The day before" @click=${() => {
			this._shift(-1);
		}}>${P("chevronBack")}</button>
          <button
            class="pick"
            aria-expanded=${this._calendar ? "true" : "false"}
            aria-label="${t ? "Today, " : ""}${n}: pick a day"
            @click=${() => {
			this._calendar = !this._calendar;
		}}
          >
            ${t ? "Today" : To(e)}${P("chevronDown")}
          </button>
          <button class="step" aria-label="The day after" ?disabled=${t} @click=${() => {
			this._shift(1);
		}}>${P("chevron")}</button>
          ${t ? A : O`<button class="text" @click=${() => {
			this._go(this._today);
		}}>Today</button>`}
        </div>
      </div>
      ${this._calendar && this._month ? this._renderCalendar(e) : A}
      ${this._renderFilters()}
      <rv-timetable
        .hass=${this.hass}
        .cameras=${this.cameras}
        .date=${this.date}
        .heading=${t ? "Today" : n}
        .limit=${Infinity}
        .cameraFilter=${this._cameraFilter}
        .typeFilter=${this._typeFilter}
        @rv-timetable-feed=${(e) => {
			this._feed = e.detail.feed;
		}}
      ></rv-timetable>`;
	}
	_renderCalendar(e) {
		let t = this._month ?? {
			year: 0,
			month: 0
		};
		return O`<div class="calendar">
      <rv-calendar
        .year=${t.year}
        .month=${t.month}
        .days=${this._days}
        .selected=${e}
        .today=${this._today}
        .firstDay=${Gn(this.hass?.locale?.language)}
        ?loading=${this._daysLoading}
        @rv-month=${(e) => void this._loadMonth(e.detail.year, e.detail.month)}
        @rv-day=${(e) => {
			this._go(e.detail.date);
		}}
      ></rv-calendar>
    </div>`;
	}
	_renderFilters() {
		let e = this._feed?.events ?? [], t = new Set(e.map((e) => e.camera_id)), n = this.cameras.filter((e) => t.has(e.id) || this._cameraFilter.has(e.id)), r = [.../* @__PURE__ */ new Set([...e.flatMap((e) => Ta(e.types)), ...this._typeFilter])];
		if (!n.length && !r.length) return A;
		let i = this._cameraFilter.size > 0 || this._typeFilter.size > 0;
		return O`<div class="filters">
      ${n.length ? O`<div class="group" role="group" aria-label="Cameras">
            <span class="label">Cameras</span>
            ${n.map((e) => O`<button
                class="chip"
                aria-pressed=${this._cameraFilter.has(e.id) ? "true" : "false"}
                @click=${() => {
			this._cameraFilter = this._toggle(this._cameraFilter, e.id);
		}}
              >
                <span class="plat" aria-hidden="true">${e.number}</span>${e.name}
              </button>`)}
          </div>` : A}
      ${r.length ? O`<div class="group" role="group" aria-label="What was detected">
            <span class="label">Detected</span>
            ${wa(r).map((e) => O`<button
                class="chip"
                aria-pressed=${this._typeFilter.has(e) ? "true" : "false"}
                @click=${() => {
			this._typeFilter = this._toggle(this._typeFilter, e);
		}}
              >
                ${P(Ha([e]))}${Ca(e)}
              </button>`)}
          </div>` : A}
      ${i ? O`<button class="text clear" @click=${() => {
			this._cameraFilter = /* @__PURE__ */ new Set(), this._typeFilter = /* @__PURE__ */ new Set();
		}}>Show every event</button>` : A}
    </div>`;
	}
	static styles = [F, o`
      :host {
        display: block;
      }
      .head {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px 24px;
        padding: 20px 24px 14px;
      }
      h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 28px;
        font-weight: 600;
        line-height: 1.1;
      }
      .day-nav {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .step {
        width: 36px;
        padding: 0;
        display: grid;
        place-items: center;
      }
      .pick {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px 4px 14px;
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .pick svg {
        width: 18px;
        height: 18px;
      }
      .calendar {
        padding: 0 24px 14px;
      }
      rv-calendar {
        display: block;
        max-width: 340px;
      }
      .filters {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 0 24px 6px;
      }
      .group {
        display: flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .label {
        flex: none;
        width: 64px;
        color: var(--rv-muted);
        font-size: 13px;
        font-weight: 500;
      }
      .chip {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 34px;
        padding: 0 12px 0 5px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip svg {
        width: 18px;
        height: 18px;
        margin-left: 4px;
      }
      .chip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .chip[aria-pressed="true"]:hover {
        background: var(--rv-text);
      }
      .plat {
        min-width: 22px;
        height: 22px;
        padding: 0 3px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 14px;
        font-weight: 600;
        line-height: 1;
      }
      .clear {
        padding-left: 0;
      }
      @media (max-width: 600px) {
        .head {
          padding: 14px 12px 10px;
        }
        .calendar,
        .filters {
          padding-left: 12px;
          padding-right: 12px;
        }
        h1 {
          font-size: 24px;
        }
        .label {
          width: auto;
          margin-right: 4px;
        }
      }
    `];
};
function wo(e) {
	return (/* @__PURE__ */ new Date(`${e}T00:00:00Z`)).toLocaleDateString(void 0, {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC"
	});
}
function To(e) {
	return (/* @__PURE__ */ new Date(`${e}T00:00:00Z`)).toLocaleDateString(void 0, {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC"
	});
}
customElements.get("rv-events") || customElements.define("rv-events", Co);
//#endregion
//#region src/components/findings.ts
var Eo = class extends M {
	static properties = { summary: { attribute: !1 } };
	render() {
		let e = this.summary;
		if (!e) return A;
		let t = [
			"good",
			"fine",
			"slow",
			"problem",
			"pending"
		].filter((t) => e.findings.some((e) => e.grade === t));
		return O`<p class="headline">${e.headline}</p>
      ${e.findings.length ? O`<ul>
            ${e.findings.map((e) => O`<li class=${e.grade}>
                <span class="grade">${Kt[e.grade]}</span>
                <span class="what">
                  <span>${e.text}</span>
                  ${e.advice ? O`<span class="advice">${e.advice}</span>` : A}
                </span>
              </li>`)}
          </ul>
          ${t.length > 1 ? O`<p class="key">${t.map((e) => `${Kt[e]}: ${qt[e]}`).join(" · ")}</p>` : A}` : A}`;
	}
	static styles = [F, o`
      :host {
        display: block;
      }
      .headline {
        margin: 0 0 10px;
        max-width: none;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
        line-height: 1.2;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule-strong);
      }
      li {
        display: grid;
        grid-template-columns: 86px minmax(0, 1fr);
        column-gap: 14px;
        align-items: baseline;
        padding: 10px 0;
        border-bottom: 1px solid var(--rv-rule);
        font-size: 16px;
      }
      .grade {
        justify-self: start;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
      }
      /* What needs a look stands out: a problem in the fault colour, slow ruled in it. */
      .problem .grade,
      .slow .grade {
        padding: 0 6px;
        border: 1.5px solid var(--rv-fault);
      }
      .problem .grade {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .slow .grade {
        color: var(--rv-fault-ink);
      }
      .note .grade,
      .pending .grade {
        color: var(--rv-muted);
      }
      .what {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-width: 72ch;
      }
      .advice {
        color: var(--rv-muted);
        font-size: 15px;
      }
      .key {
        margin: 8px 0 0;
        max-width: none;
        color: var(--rv-muted);
        font-size: 13px;
      }
      @media (max-width: 600px) {
        li {
          grid-template-columns: 72px minmax(0, 1fr);
          column-gap: 10px;
          font-size: 15px;
        }
        .headline {
          font-size: 20px;
        }
      }
    `];
};
customElements.get("rv-findings") || customElements.define("rv-findings", Eo);
//#endregion
//#region src/components/playback.ts
var Do = 6e4, Oo = 1e4, ko = 86400, Ao = 10 * Z, jo = 10, Mo = 8e3, No = 3 * Z, Po = 1e3, Fo = 6e4, Io = "reolink-viewer-check-setup", Lo = "reolink-viewer-player", Ro = !1, zo = class extends M {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		cameraName: { attribute: !1 },
		at: { attribute: !1 },
		_date: { state: !0 },
		_day: { state: !0 },
		_error: { state: !0 },
		_playFailure: { state: !0 },
		_loading: { state: !0 },
		_view: { state: !0 },
		_cursor: { state: !0 },
		_only: { state: !0 },
		_month: { state: !0 },
		_monthDays: { state: !0 },
		_monthLoading: { state: !0 },
		_stream: { state: !0 },
		_hd: { state: !0 },
		_playing: { state: !0 },
		_hover: { state: !0 },
		_thumbs: { state: !0 },
		_metrics: { state: !0 },
		_checkText: { state: !0 },
		_checkRunning: { state: !0 },
		_checkSetup: { state: !0 },
		_checkSession: { state: !0 },
		_checkHdPart: { state: !0 },
		_checkNote: { state: !0 },
		_reports: { state: !0 },
		_rate: { state: !0 },
		_note: { state: !0 },
		_mode: { state: !0 }
	};
	_daySeq = 0;
	_openedAt;
	_playSeq = 0;
	_hoverSeq = 0;
	_monthSeq = 0;
	_thumbsRequested = /* @__PURE__ */ new Set();
	thumbLoader = new qa();
	_thumbPause;
	_eventsRetry;
	_eventsRetries = 0;
	_refreshTimer;
	_lastCursorPaint = 0;
	_progressive = un();
	_check;
	_starting;
	_preloadPending;
	_recoveredAt = -Infinity;
	_mseFailed = /* @__PURE__ */ new Set();
	_lastPreview = 0;
	constructor() {
		super(), this.deviceId = "", this.cameraName = "", this._date = "", this._loading = !1, this._view = {
			start: 0,
			span: ra
		}, this._only = /* @__PURE__ */ new Set();
		let e = /* @__PURE__ */ new Date();
		this._month = {
			year: e.getFullYear(),
			month: e.getMonth() + 1
		}, this._monthDays = /* @__PURE__ */ new Set(), this._monthLoading = !1, this._stream = "sub", this._hd = {
			main: !1,
			reason: "checking…"
		}, this._thumbs = /* @__PURE__ */ new Map(), this._metrics = {}, this._checkText = "", this._checkRunning = !1, this._checkSetup = Ko(), this._checkSession = !1, this._checkHdPart = xi(this._checkSetup), this._rate = 1, this._mode = qo();
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return Un(Date.now(), this._zone);
	}
	get _player() {
		return this.renderRoot.querySelector("rv-player");
	}
	get _timeline() {
		return this.renderRoot.querySelector("rv-timeline");
	}
	get _events() {
		return _a(this._day?.events ?? [], this._only);
	}
	connectedCallback() {
		super.connectedCallback(), this._refreshTimer = setInterval(() => {
			this._date === this._today && document.visibilityState !== "hidden" && this._loadDay(this._date, {
				keepView: !0,
				quiet: !0
			});
		}, Do);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._refreshTimer), this._player?.stop(), this.thumbLoader.clear(), clearTimeout(this._thumbPause), clearTimeout(this._eventsRetry), this._check?.stop();
	}
	willUpdate(e) {
		if ((e.has("deviceId") || e.has("hass")) && this.hass && this.deviceId && !this._date) {
			this._date = this.at === void 0 ? this._today : Un(this.at, this._zone);
			let [e, t] = this._date.split("-").map(Number);
			e && t && (this._month = {
				year: e,
				month: t
			}), this._loadDay(this._date).then(() => {
				this._openAt();
			}), this._loadMonth(this._month.year, this._month.month), this._checkHd(), Ro || (Ro = !0, ta(this.hass).then((e) => {
				this._checkNote = e;
			}));
		} else if (e.has("at") && this.at !== void 0 && this._date) {
			let e = Un(this.at, this._zone);
			e === this._date ? this._openAt() : this._selectDate(e).then(() => {
				this._openAt();
			});
		}
	}
	_openAt() {
		let e = this.at, t = this._day;
		e !== void 0 && e !== this._openedAt && t && Un(e, this._zone) === t.date && (this._openedAt = e, this._cursor = e, this._view = la(this._view, e, t), this.playAt(e));
	}
	async _loadDay(e, t = {}) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._daySeq, i = performance.now(), a = !1;
		t.quiet || (this._loading = !0);
		try {
			let o = await He(n, this.deviceId, e, t.quiet ? 0 : ko);
			if (r !== this._daySeq) return;
			let s = !this._day || this._day.date !== o.date;
			if (this._day = o, this._error = void 0, s || !t.keepView) {
				this._view = oa({
					start: o.start,
					span: o.end - o.start
				}, o);
				let e = o.events.at(-1)?.start ?? o.segments.at(-1)?.start;
				this._cursor = e;
			} else this._view = oa(this._view, o);
			await this.updateComplete, t.quiet || (this._metrics = {
				...this._metrics,
				timelineMs: performance.now() - i,
				timelineServer: o.timing
			}), this._warmLongRecording(o), a = !t.quiet && o.timing.cache === "stale", this._retryEventsSoon(o);
		} catch (e) {
			r === this._daySeq && (this._error = N(e).message);
		} finally {
			r === this._daySeq && (this._loading = !1);
		}
		a && await this._loadDay(e, {
			keepView: !0,
			quiet: !0
		});
	}
	_retryEventsSoon(e) {
		clearTimeout(this._eventsRetry), !e.events_error || e.complete ? this._eventsRetries = 0 : this._eventsRetries >= 3 || (this._eventsRetries += 1, this._eventsRetry = setTimeout(() => {
			this._date === e.date && this._loadDay(e.date, {
				keepView: !0,
				quiet: !0
			});
		}, Oo));
	}
	async _loadMonth(e, t) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._monthSeq;
		this._month = {
			year: e,
			month: t
		}, this._monthLoading = !0;
		try {
			let i = await Ve(n, this.deviceId, e, t);
			r === this._monthSeq && (this._monthDays = new Set(i.days));
		} catch {
			r === this._monthSeq && (this._monthDays = /* @__PURE__ */ new Set());
		} finally {
			r === this._monthSeq && (this._monthLoading = !1);
		}
	}
	async _checkHd() {
		let e = this.hass;
		if (e) try {
			let t = await tt(e, this.deviceId);
			this._hd = await ln(t.main), this._metrics = {
				...this._metrics,
				hd: this._hd.reason
			};
		} catch {
			this._hd = {
				main: !1,
				reason: "main stream information unavailable"
			};
		}
	}
	_warmLongRecording(e) {
		let t = this.hass, n = this._cursor === void 0 ? e.segments.at(-1) : ma(e.segments, this._cursor);
		!t || !n || n.end - n.start < Ao || $e(t, this._ref(n)).catch(() => void 0);
	}
	_ref(e, t = this._stream) {
		return {
			deviceId: this.deviceId,
			date: this._date,
			segmentId: e.id,
			stream: t
		};
	}
	async playAt(e, t = performance.now()) {
		let n = this.hass, r = this._day;
		if (!n || !r) return;
		let i = ga(r.segments, e);
		if (!i) {
			L(this, "No recording after this time on this day");
			return;
		}
		let a = ++this._playSeq;
		this._playFailure = void 0, this._pauseThumbs();
		let o = i.segment.start + i.offset;
		if (this._cursor = o, this._seekWithin(i.segment, o, t)) {
			this._schedulePreload(i.segment, a, o);
			return;
		}
		this._starting = a;
		let s = performance.now();
		try {
			let e = this._useMse(this._stream), r = this._progressive && i.offset < 3e3, c = this._ref(i.segment), l = e ? await Ye(n, c, o) : await Je(n, c, r, o);
			if (a !== this._playSeq) {
				this._release(l);
				return;
			}
			this._playing = l, this._metrics = {
				...this._metrics,
				urlMs: performance.now() - s,
				firstFrameMs: void 0,
				gapMs: void 0,
				stream: l.stream,
				cache: l.cache,
				codec: l.media?.codec ?? null,
				delivery: e ? `MSE (${G() ?? "?"})${l.cache.complete ? ", cached" : ""}` : Wo(r, this._progressive, l.cache.complete)
			};
			let u = Math.max(0, o - l.start);
			await this._player?.play(this._toItem(l), u, t), this._showDownload(l, a), this._schedulePreload(i.segment, a, o);
		} catch (e) {
			a === this._playSeq && this._playError(N(e).message);
		} finally {
			this._starting === a && (this._starting = void 0);
		}
	}
	_seekWithin(e, t, n) {
		let r = this._player, i = r?.current;
		return !r?.mse || !this._useMse(this._stream) || !i || i.segmentId !== e.id || this._playing?.stream !== this._stream || i.end < e.end && t > i.end - Fo ? !1 : (this._metrics = {
			...this._metrics,
			urlMs: 0,
			firstFrameMs: void 0,
			delivery: `MSE (${G() ?? "?"}), same recording`
		}, r.seekWithin(Math.max(0, t - i.start), n), !0);
	}
	_describeMode() {
		let e = G();
		if (this._mode === "file") return "file player only (set under Details)";
		if (!e) return "file player (this browser has no MSE)";
		if (typeof this.hass?.fetchWithAuth != "function") return "file player (no authenticated fetch)";
		let t = [...this._mseFailed];
		return `MSE (${e})${t.length ? `, file player for ${t.join(", ")} after a failure` : ""}`;
	}
	_useMse(e) {
		return this._mode === "auto" && G() !== void 0 && typeof this.hass?.fetchWithAuth == "function" && !this._mseFailed.has(e);
	}
	_release(e) {
		let t = this.hass, n = Xe(e.base ?? e.url ?? "");
		t && n && Ze(t, [n]).catch(() => void 0);
	}
	_toItem(e) {
		let t = {
			recording: `${e.stream}:${e.segment_id}:${e.end}`,
			segmentId: e.segment_id,
			start: e.start,
			end: e.end,
			release: () => {
				this._release(e);
			}
		}, n = this.hass;
		if (e.base && n?.fetchWithAuth) {
			let r = n.fetchWithAuth.bind(n);
			return {
				...t,
				key: e.base,
				mse: {
					base: e.base,
					fetch: r,
					durationMs: e.end - e.start
				}
			};
		}
		let r = e.url ?? "";
		return {
			...t,
			key: r,
			url: r
		};
	}
	async _showDownload(e, t) {
		let n = this.hass, r = Xe(e.base ?? e.url ?? "");
		if (!n || !r || e.cache.complete) return;
		let i = () => t === this._playSeq && this._metrics.firstFrameMs === void 0 && !this._playFailure;
		for (; i() && (await Bo(Po), i());) try {
			let t = await Qe(n, r);
			if (!i() || !t.cache || t.cache.complete || t.cache.error) break;
			let a = e.stream === "main" ? "HD " : "";
			this._note = `Fetching the ${a}recording from the recorder: ${Vo(t.cache.bytes)} of about ${Vo(t.expected_bytes)}`;
		} catch {
			break;
		}
		t === this._playSeq && (this._note = void 0);
	}
	_schedulePreload(e, t, n) {
		this._preloadPending = void 0;
		let r = this.hass, i = this._nextSegment(e);
		!r || !i || e.end - n <= No ? this._preloadAfter(e, t) : (this._player?.preload(void 0), $e(r, this._ref(i)).catch(() => void 0), this._preloadPending = {
			segment: e,
			seq: t
		});
	}
	_nextSegment(e) {
		let t = this._day?.segments ?? [], n = t.findIndex((t) => t.id === e.id);
		return n >= 0 ? t.at(n + 1) : void 0;
	}
	async _preloadAfter(e, t) {
		let n = this.hass, r = this._nextSegment(e);
		if (!n || !r) await this._player?.preload(void 0);
		else if (!this._player?.preloaded?.recording.startsWith(`${this._stream}:${r.id}:`)) try {
			let e = this._ref(r), i = this._useMse(this._stream) ? await Ye(n, e, r.start) : await Je(n, e, this._progressive, r.start);
			if (t !== this._playSeq) {
				this._release(i);
				return;
			}
			await this._player?.preload(this._toItem(i));
		} catch {}
	}
	_onAdvanced(e) {
		let t = this._day?.segments.find((t) => t.id === e.segmentId);
		this._metrics = {
			...this._metrics,
			gapMs: e.gapMs
		}, t && (this._cursor = t.start, this._schedulePreload(t, this._playSeq, t.start));
	}
	_onEnded(e) {
		let t = this._day?.segments ?? [], n = t.findIndex((t) => t.id === e), r = n >= 0 ? t[n + 1] : void 0;
		r && this.playAt(r.start);
	}
	_pauseThumbs() {
		this.thumbLoader.pause(), clearTimeout(this._thumbPause), this._thumbPause = setTimeout(() => {
			this._resumeThumbs();
		}, Mo);
	}
	_resumeThumbs() {
		clearTimeout(this._thumbPause), this.thumbLoader.resume();
	}
	_onPlayerError(e) {
		if (e.fallback && this._useMse(this._stream)) {
			this._mseFailed.add(this._stream), this._metrics = {
				...this._metrics,
				fallbacks: (this._metrics.fallbacks ?? 0) + 1,
				lastFallback: e.message
			};
			let t = e.played ? this._player?.time ?? this._cursor : this._cursor;
			t !== void 0 && this.playAt(t);
			return;
		}
		let t = this._player?.time, n = performance.now();
		e.played && t !== void 0 && n - this._recoveredAt > 6e4 ? (this._recoveredAt = n, this._metrics = {
			...this._metrics,
			recoveries: (this._metrics.recoveries ?? 0) + 1,
			lastRecovery: e.message
		}, this.playAt(t)) : this._playError(e.message);
	}
	_playError(e) {
		this._resumeThumbs(), this._stream === "main" ? (this._stream = "sub", this._metrics = {
			...this._metrics,
			hdFailures: (this._metrics.hdFailures ?? 0) + 1,
			lastHdFailure: e
		}, L(this, `HD failed (${e}); back to the sub stream`, "error"), this._cursor !== void 0 && this.playAt(this._cursor)) : (this._playFailure = e, L(this, `Playback failed: ${e}`, "error"));
	}
	_onTime(e) {
		if (this._starting !== void 0) return;
		let t = performance.now();
		if (t - this._lastCursorPaint < 250) return;
		this._lastCursorPaint = t;
		let n = this._preloadPending;
		n && n.seq === this._playSeq && n.segment.end - e <= No && (this._preloadPending = void 0, this._preloadAfter(n.segment, n.seq)), this._cursor = e, (e > this._view.start + this._view.span || e < this._view.start) && (this._view = la(this._view, e, this._day ?? {
			start: e,
			end: e + this._view.span
		}));
	}
	_onScrub(e) {
		this._cursor = e;
		let t = performance.now();
		t - this._lastPreview < 80 || (this._lastPreview = t, this._player?.preview(e));
	}
	_jump(e) {
		let t = this._cursor ?? this._view.start, n = e > 0 ? va(this._events, t) : ya(this._events, t);
		n ? (this._cursor = n.start, this._day && (this._view = la(this._view, n.start, this._day)), this.playAt(n.start)) : L(this, e > 0 ? "No later event" : "No earlier event");
	}
	_setRate(e) {
		this._rate = e;
	}
	_setMode(e) {
		this._mode = e, this._mseFailed.clear(), Jo(e);
		let t = this._player?.time ?? this._cursor;
		this._playing && t !== void 0 && this.playAt(t);
	}
	_setStream(e) {
		if (e === this._stream) return;
		this._stream = e;
		let t = this._player?.time ?? this._cursor;
		this._playing && t !== void 0 && this.playAt(t);
	}
	_changeDay(e) {
		let [t, n, r] = this._date.split("-").map(Number);
		if (!t || !n || !r) return;
		let i = new Date(Date.UTC(t, n - 1, r + e)).toISOString().slice(0, 10);
		i > this._today || this._selectDate(i);
	}
	_selectDate(e) {
		this._date = e, this._player?.stop(), this._playing = void 0, this._preloadPending = void 0, this.thumbLoader.clear(), this._thumbs = /* @__PURE__ */ new Map(), this._thumbsRequested.clear();
		let t = this._loadDay(e), [n, r] = e.split("-").map(Number);
		return n && r && (n !== this._month.year || r !== this._month.month) && this._loadMonth(n, r), t;
	}
	async _onHover(e) {
		let t = this.hass;
		if (!t || !this._day || !ma(this._day.segments, e.time)) {
			this._hoverSeq += 1, this._hover = {
				x: e.x,
				time: e.time,
				gap: !0
			};
			return;
		}
		let n = ++this._hoverSeq, r = {
			x: e.x,
			time: e.time
		};
		this._hover = r;
		try {
			let i = (await et(t, this.deviceId, [e.time], Da(this._view.span))).urls[0]?.url;
			n === this._hoverSeq && (this._hover = i ? {
				...r,
				url: i
			} : r);
		} catch {}
	}
	async _loadThumbs(e) {
		let t = this.hass, n = e.filter((e) => !this._thumbsRequested.has(e));
		if (t && n.length) {
			n.forEach((e) => this._thumbsRequested.add(e));
			try {
				let e = await et(t, this.deviceId, n, jo), r = this._date;
				e.urls.forEach((e, t) => {
					let i = n[t] ?? e.time;
					this.thumbLoader.load(e.url).then((t) => {
						!t || r !== this._date ? this._thumbsRequested.delete(i) : this._thumbs = new Map(this._thumbs).set(i, e.url);
					});
				});
			} catch {
				n.forEach((e) => this._thumbsRequested.delete(e));
			}
		}
	}
	async runCheck(e) {
		if (this._check?.running) return this._check.text;
		let t = new Ri(this._checkTarget(), e, () => {
			this._checkText = t.text;
		});
		this._check = t, this._checkRunning = !0, this._checkText = "";
		try {
			return await t.run();
		} finally {
			this._checkRunning = !1, this._checkText = t.text, this._reports = void 0;
		}
	}
	_checkTarget() {
		let e = this;
		return {
			get hass() {
				if (!e.hass) throw Error("not connected");
				return e.hass;
			},
			get deviceId() {
				return e.deviceId;
			},
			get cameraName() {
				return e.cameraName;
			},
			get date() {
				return e._date;
			},
			get today() {
				return e._today;
			},
			get day() {
				return e._day;
			},
			get loading() {
				return e._loading;
			},
			get metrics() {
				return e._metrics;
			},
			get playFailure() {
				return e._playFailure;
			},
			get hd() {
				return e._hd;
			},
			get progressive() {
				return e._progressive;
			},
			get mode() {
				return e._describeMode();
			},
			get stream() {
				return e._stream;
			},
			setStream: (t) => {
				e._setStream(t);
			},
			get monthDays() {
				return e._monthDays;
			},
			get player() {
				return e._player;
			},
			get playing() {
				return e._playing;
			},
			selectDate: (t) => {
				e._selectDate(t);
			},
			playAt: (t, n) => e.playAt(t, n)
		};
	}
	async _loadReports() {
		if (this.hass) try {
			this._reports = (await na(this.hass)).reports.filter((e) => !e.setup.startsWith(io));
		} catch (e) {
			L(this, `Could not load the reports: ${N(e).message}`, "error");
		}
	}
	async _copy(e) {
		await Zn(e) ? L(this, "Report copied") : L(this, "Copying is blocked here: select the report text and copy it", "error");
	}
	_renderCheck() {
		let e = this._checkRunning, t = e ? this._check?.inShort() : Qt(this._checkText);
		return O`<div class="check">
      <h3>Playback check</h3>
      <p class="small">
        How quickly ${this.cameraName}'s recordings open and play on this device: the timeline, events,
        long recordings, fast forward and HD. It takes a few minutes; keep this page open and in front.
        Each run is saved, so you can read it later on any device.
      </p>
      ${this._checkNote ? O`<div class="banner error" role="alert">${this._checkNote}</div>` : A}
      <div class="form">
        <span class="label" id="check-setup">This device and network</span>
        <div class="field">
          <select
            aria-labelledby="check-setup"
            ?disabled=${e}
            @change=${(e) => {
			this._checkSetup = e.target.value, this._checkHdPart = xi(this._checkSetup), Yo(this._checkSetup);
		}}
          >
            ${bi.map((e) => O`<option .value=${e} ?selected=${e === this._checkSetup}>${e}</option>`)}
          </select>
        </div>
        <span class="label">Also</span>
        <div class="field stack">
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._checkHdPart}
              ?disabled=${e}
              @change=${(e) => {
			this._checkHdPart = e.target.checked;
		}}
            /><span
              >Switch to HD and back
              <span class="muted">(Home Assistant fetches the high-quality recording from the camera first)</span></span
            ></label
          >
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._checkSession}
              ?disabled=${e}
              @change=${(e) => {
			this._checkSession = e.target.checked;
		}}
            /><span
              >Then play for ${60} minutes
              <span class="muted">(to see that it keeps playing smoothly)</span></span
            ></label
          >
        </div>
      </div>
      <div class="actions">
        ${e ? O`<button
              @click=${() => {
			this._check?.stop();
		}}
            >
              Stop
            </button>` : O`<button
              class="primary"
              @click=${() => void this.runCheck({
			setup: this._checkSetup,
			soakMinutes: this._checkSession ? 60 : 0,
			hd: this._checkHdPart
		})}
            >
              Run playback check
            </button>`}
        <button @click=${() => void this._loadReports()}>Saved reports</button>
      </div>
      ${t ? O`<rv-findings .summary=${t}></rv-findings>` : A}
      ${this._checkText ? O`<details class="support">
            <summary class="small">Details for support${P("chevronDown")}</summary>
            <div class="actions">
              <button @click=${() => void this._copy(this._checkText)}>Copy report</button>
            </div>
            <pre class="report">${this._checkText}</pre>
          </details>` : A}
      ${this._reports ? O`<ul class="reports">
            ${this._reports.length ? this._reports.map((e) => O`<li>
                    <span class="when">${Hn(Date.parse(e.updated), this._zone)} · ${e.setup}${e.done ? "" : " · running or cut short"}</span>
                    <button class="text" @click=${() => void this._copy(e.text)}>Copy</button>
                    <button
                      class="text"
                      @click=${() => {
			this._checkText = e.text;
		}}
                    >
                      Show
                    </button>
                  </li>`) : O`<li class="muted">No saved reports yet</li>`}
          </ul>` : A}
    </div>`;
	}
	_renderToolbar() {
		let e = ca(this._view.span);
		return O`<div class="toolbar">
      <div class="group transport">
        <button aria-label="Previous event" title="Previous event" @click=${() => {
			this._jump(-1);
		}}>${P("previous")}</button>
        <button
          class="play"
          aria-label=${this._player?.paused === !1 ? "Pause" : "Play"}
          @click=${() => {
			let e = this._player;
			e?.current ? e.paused ? e.resume() : e.pause() : this._cursor !== void 0 && this.playAt(this._cursor), this.requestUpdate();
		}}
        >${P(this._player?.paused === !1 ? "pause" : "play")}</button>
        <button aria-label="Next event" title="Next event" @click=${() => {
			this._jump(1);
		}}>${P("next")}</button>
      </div>
      <div class="group" role="group" aria-label="Zoom">
        <button aria-label="Zoom out" ?disabled=${e === 0} @click=${() => this._timeline?.zoom(-1)}>${P("minus")}</button>
        <span class="zoom">${Xo(this._view.span)}</span>
        <button
          aria-label="Zoom in"
          ?disabled=${e === $.length - 1}
          @click=${() => this._timeline?.zoom(1)}
        >${P("plus")}</button>
      </div>
      <div class="group quality" role="group" aria-label="Quality">
        <button
          class="seg"
          aria-pressed=${this._stream === "sub" ? "true" : "false"}
          @click=${() => {
			this._setStream("sub");
		}}
        >SD</button>
        <button
          class="seg"
          aria-pressed=${this._stream === "main" ? "true" : "false"}
          ?disabled=${!this._hd.main}
          title=${this._hd.reason}
          @click=${() => {
			this._setStream("main");
		}}
        >HD</button>
      </div>
      <div class="group">
        <label class="speed"
          >Speed
          <select
            aria-label="Playback speed"
            @change=${(e) => {
			this._setRate(Number(e.target.value));
		}}
          >
            ${Ga.map((e) => O`<option .value=${String(e)} ?selected=${e === this._rate}>${e}×</option>`)}
          </select></label
        >
        ${this._playing ? O`<a class="download" href=${this._playing.clip_url} download>${P("download")}Download clip</a>` : A}
      </div>
    </div>`;
	}
	_renderFilters() {
		let e = this._day?.events ?? [], t = [.../* @__PURE__ */ new Set([...Ea(e), ...this._only])];
		return t.length ? O`<div class="chips" role="group" aria-label="What was detected">
      ${t.map((t) => O`<button
          class="chip"
          aria-pressed=${this._only.has(t) ? "true" : "false"}
          @click=${() => {
			let e = new Set(this._only);
			e.delete(t) || e.add(t), this._only = e;
		}}
        >
          ${P(Ha([t]))}${Ca(t)}
          <span class="count">${e.filter((e) => Ta(e.types).includes(t)).length}</span>
        </button>`)}
      ${this._only.size ? O`<button class="text clear" @click=${() => {
			this._only = /* @__PURE__ */ new Set();
		}}>Show every event</button>` : A}
    </div>` : A;
	}
	_renderHover() {
		let e = this._hover;
		return e ? O`<div class="hover" style="left: ${Math.max(0, e.x - 80)}px">
      ${e.gap ? A : e.url ? O`<img src=${e.url} alt="" />` : O`<div class="noimg"></div>`}
      <span>${K(e.time, this._zone, !0)}${e.gap ? " · no recording" : ""}</span>
    </div>` : A;
	}
	_renderDebug() {
		let e = this._metrics, t = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, n = e.timelineServer;
		return O`<details class="debug">
      <summary class="small">Details and playback check${P("chevronDown")}</summary>
      ${this._renderCheck()}
      <details class="tech">
        <summary class="small">Technical details${P("chevronDown")}</summary>
        <dl class="facts">
        <dt>Time to timeline</dt>
        <dd>
          ${t(e.timelineMs)}
          ${n ? O`<span class="muted">(server: ${n.cache ?? "?"}${n.search_ms === void 0 ? "" : `, search ${Math.round(n.search_ms)} ms`})</span>` : A}
        </dd>
        <dt>Time to first frame</dt>
        <dd>${t(e.firstFrameMs)} <span class="muted">(URL ${t(e.urlMs)})</span></dd>
        <dt>Gap at last file change</dt>
        <dd>${t(e.gapMs)}</dd>
        <dt>Reloaded mid-way</dt>
        <dd>${e.recoveries ? `${e.recoveries}× (last: ${e.lastRecovery ?? "?"})` : "never"}</dd>
        <dt>Stream</dt>
        <dd>${e.stream ?? this._stream}${e.codec ? ` · ${e.codec}` : ""}</dd>
        <dt>Cache</dt>
        <dd>${e.cache ? Go(e.cache) : "–"}</dd>
        <dt>HD</dt>
        <dd>${this._hd.reason}</dd>
        <dt>Delivery</dt>
        <dd>
          ${e.delivery ?? (this._progressive ? "progressive" : "whole file first (WebKit)")}${this._playing?.file ? ` · ${this._playing.file} file` : ""}
        </dd>
        <dt>Player</dt>
        <dd>
          ${Uo(this._player)}
          <select
            aria-label="Player"
            @change=${(e) => {
			this._setMode(e.target.value);
		}}
          >
            <option value="auto" ?selected=${this._mode === "auto"}>MSE where possible</option>
            <option value="file" ?selected=${this._mode === "file"}>File player only</option>
          </select>
        </dd>
        <dt>Fell back to the file player</dt>
        <dd>${e.fallbacks ? `${e.fallbacks}× (last: ${e.lastFallback ?? "?"})` : "never"}</dd>
        <dt>Day</dt>
        <dd>
          ${this._day ? `${this._day.segments.length} recordings, ${this._day.events.length} events${this._day.complete ? ", final" : ""}${this._day.events_error ? `, event search failed (${this._day.events_error})` : ""}` : "–"}
        </dd>
        </dl>
      </details>
    </details>`;
	}
	render() {
		let e = this._day, t = this._zone;
		return O`
      <div class="layout">
        <div class="main">
          <rv-player
            .rate=${this._rate}
            .note=${this._note}
            @rv-first-frame=${(e) => {
			let t = this._metrics.codec ?? Ho(this._player?.mseStats?.mime);
			this._metrics = {
				...this._metrics,
				firstFrameMs: e.detail.ms,
				codec: t
			}, this._resumeThumbs();
		}}
            @rv-advanced=${(e) => {
			this._onAdvanced(e.detail);
		}}
            @rv-ended=${(e) => {
			this._onEnded(e.detail.segmentId);
		}}
            @rv-time=${(e) => {
			this._onTime(e.detail.time);
		}}
            @rv-player-error=${(e) => {
			this._onPlayerError(e.detail);
		}}
          ></rv-player>
          <div class="dayline">
            <div class="day-nav" role="group" aria-label="Day">
              <button class="step" aria-label="Previous day" @click=${() => {
			this._changeDay(-1);
		}}>${P("chevronBack")}</button>
              <span class="day" title=${wo(this._date)}>
                ${this._date === this._today ? "Today" : To(this._date)}
              </span>
              <button
                class="step"
                aria-label="Next day"
                ?disabled=${this._date >= this._today}
                @click=${() => {
			this._changeDay(1);
		}}
              >${P("chevron")}</button>
            </div>
            ${this._loading ? O`<span class="muted small">Loading…</span>` : A}
            <span class="clock">
              ${this._cursor === void 0 ? "--:--:--" : K(this._cursor, t, !0)}
            </span>
          </div>
          ${this._error ? O`<div class="banner error" role="alert">Could not load recordings: ${this._error}</div>` : A}
          ${this._playFailure ? O`<div class="banner error" role="alert">Playback failed: ${this._playFailure}</div>` : A}
          <div class="timeline-wrap">
            ${this._renderHover()}
            <rv-timeline
              .day=${e}
              .events=${this._events}
              .view=${this._view}
              .cursor=${this._cursor}
              .timeZone=${t}
              @rv-view-change=${(e) => {
			this._view = e.detail.view;
		}}
              @rv-seek=${(e) => {
			this.playAt(e.detail.time);
		}}
              @rv-scrub=${(e) => {
			this._onScrub(e.detail.time);
		}}
              @rv-hover=${(e) => void this._onHover(e.detail)}
              @rv-hover-end=${() => {
			this._hoverSeq += 1, this._hover = void 0;
		}}
            ></rv-timeline>
          </div>
          ${this._renderToolbar()} ${this._renderFilters()}
          ${e && !e.segments.length && !this._loading ? O`<p class="muted">No recordings on this day.</p>` : A}
          ${this._renderDebug()}
        </div>
        <div class="side">
          <rv-calendar
            .year=${this._month.year}
            .month=${this._month.month}
            .days=${this._monthDays}
            .selected=${this._date}
            .today=${this._today}
            .firstDay=${Gn(this.hass?.locale?.language)}
            ?loading=${this._monthLoading}
            @rv-month=${(e) => void this._loadMonth(e.detail.year, e.detail.month)}
            @rv-day=${(e) => {
			this._selectDate(e.detail.date);
		}}
          ></rv-calendar>
          <div class="events-head">
            <h2>Events</h2>
            ${e ? O`<span class="muted">
                  ${this._only.size ? `${String(this._events.length)} of ` : ""}${e.events.length}
                  ${e.events.length === 1 ? "event" : "events"}
                </span>` : A}
          </div>
          <rv-event-list
            .events=${this._events}
            .thumbs=${this._thumbs}
            .current=${this._cursor}
            .playing=${this._playing !== void 0}
            .timeZone=${t}
            @rv-pick=${(e) => {
			this._cursor = e.detail.event.start, this._day && (this._view = la(this._view, e.detail.event.start, this._day)), this.playAt(e.detail.event.start);
		}}
            @rv-thumbs-needed=${(e) => void this._loadThumbs(e.detail.times)}
          ></rv-event-list>
        </div>
      </div>
    `;
	}
	static styles = [F, o`
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 24px;
      }
      .main,
      .side {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
      }
      .side {
        gap: 14px;
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
        /* On one column the day's events come before the calendar. */
        .side rv-calendar {
          order: 2;
        }
      }
      .dayline {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 14px;
        margin-top: 4px;
      }
      .day-nav {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .step {
        width: 36px;
        padding: 0;
        display: grid;
        place-items: center;
      }
      .day {
        min-width: 7.5em;
        text-align: center;
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .clock {
        margin-left: auto;
        font-family: var(--rv-font-cond);
        font-size: 30px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.01em;
      }
      .timeline-wrap {
        position: relative;
      }
      .hover {
        position: absolute;
        bottom: calc(100% + 6px);
        z-index: 2;
        width: 160px;
        background: var(--rv-board);
        color: var(--rv-on-board);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
        font-family: var(--rv-font-cond);
        font-size: 15px;
        font-weight: 600;
        text-align: center;
        pointer-events: none;
      }
      .hover span {
        display: block;
        padding: 4px 6px 5px;
      }
      .hover img,
      .hover .noimg {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        background: var(--rv-board);
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 22px;
        padding-top: 2px;
      }
      .group {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .group > button {
        width: 40px;
        padding: 0;
        display: grid;
        place-items: center;
      }
      .group > button.play {
        width: 48px;
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .group > button.play:hover {
        background: var(--rv-text);
        opacity: 0.88;
      }
      .zoom {
        min-width: 48px;
        text-align: center;
        font-family: var(--rv-font-cond);
        font-size: 17px;
        font-weight: 600;
      }
      .quality {
        gap: 0;
      }
      .group > button.seg {
        width: 46px;
        font-family: var(--rv-font-cond);
        font-size: 16px;
        font-weight: 600;
      }
      .group > button.seg + button.seg {
        margin-left: -1px;
      }
      .group > button.seg[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .speed {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--rv-muted);
        font-size: 15px;
      }
      .speed select {
        min-height: 36px;
      }
      .download {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 6px;
        font-weight: 500;
        text-decoration: none;
      }
      .download:hover {
        text-decoration: underline;
      }
      .download svg {
        width: 18px;
        height: 18px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 34px;
        padding: 0 10px 0 9px;
        border: 1px solid var(--rv-rule);
        font-size: 15px;
        font-weight: 500;
        white-space: nowrap;
      }
      .chip svg {
        width: 18px;
        height: 18px;
      }
      .chip .count {
        color: var(--rv-muted);
        font-weight: 400;
      }
      .chip[aria-pressed="true"] {
        background: var(--rv-text);
        border-color: var(--rv-text);
        color: var(--rv-ground);
      }
      .chip[aria-pressed="true"] .count {
        color: inherit;
        opacity: 0.75;
      }
      .chip[aria-pressed="true"]:hover {
        background: var(--rv-text);
      }
      .clear {
        padding-left: 4px;
      }
      .events-head {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }
      .events-head h2 {
        margin: 0;
      }
      .events-head span {
        font-size: 15px;
      }

      @media (max-width: 600px) {
        .clock {
          font-size: 24px;
        }
        .toolbar {
          gap: 10px 14px;
        }
      }
      .debug dl {
        font-size: 13px;
      }
      .tech {
        margin-top: 12px;
      }
      .check {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 10px;
        padding-top: 12px;
        border-top: 2px solid var(--rv-rule-strong);
      }
      .check h3 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 21px;
      }
      .check p {
        margin: 0;
      }
      .check .support > .actions {
        margin: 6px 0 10px;
      }
      .reports {
        list-style: none;
        margin: 0;
        padding: 0;
        border-top: 1px solid var(--rv-rule);
      }
      .reports li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
      }
      .reports .when {
        flex: 1;
        min-width: 14em;
        font-size: 15px;
      }
    `];
}, Bo = (e) => new Promise((t) => {
	setTimeout(t, e);
}), Vo = (e) => `${Math.round(e / 1e6)} MB`;
function Ho(e) {
	return /codecs="?([^",]+)/.exec(e ?? "")?.[1] ?? null;
}
function Uo(e) {
	let t = e?.mseStats;
	return t ? [
		t.api,
		t.mime.replace(/^video\/mp4; codecs=/, ""),
		`${t.windows} windows, ${(t.bytes / 1e6).toFixed(1)} MB${t.lastWaitMs === void 0 ? "" : `, last in ${Math.round(t.lastWaitMs)} ms`}`,
		`${Math.round(t.ahead)} s ahead, ${Math.round(t.behind)} s behind`,
		`${t.trims} trims`
	].join(" · ") : e?.current ? "file player" : "–";
}
function Wo(e, t, n) {
	return n ? "cached file (Range)" : e ? "progressive" : t ? "whole file first (to seek)" : "whole file first (WebKit)";
}
function Go(e) {
	let t = `${(e.bytes / 1e6).toFixed(1)} MB`;
	return e.error ? `failed: ${e.error}` : e.complete ? `cached (${t})` : `filling (${t} so far)`;
}
function Ko() {
	try {
		let e = window.localStorage.getItem(Io);
		if (e && bi.includes(e)) return e;
	} catch {}
	return Yr(navigator.userAgent);
}
function qo() {
	try {
		return window.localStorage.getItem(Lo) === "file" ? "file" : "auto";
	} catch {
		return "auto";
	}
}
function Jo(e) {
	try {
		window.localStorage.setItem(Lo, e);
	} catch {}
}
function Yo(e) {
	try {
		window.localStorage.setItem(Io, e);
	} catch {}
}
function Xo(e) {
	return e >= 36e5 ? `${Math.round(e / 36e5)} h` : `${Math.round(e / Z)} min`;
}
customElements.get("rv-playback") || customElements.define("rv-playback", zo);
//#endregion
//#region src/components/device-page.ts
var Zo = 1e3, Qo = class extends M {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		tab: { attribute: !1 },
		at: { attribute: !1 },
		cameras: { attribute: !1 },
		devices: { attribute: !1 },
		_device: { state: !0 },
		_catalog: { state: !0 },
		_error: { state: !0 }
	};
	renderCount = 0;
	_watched = [];
	_renderedStates;
	_loadSeq = 0;
	_unsubRegistry;
	_reloadTimer;
	constructor() {
		super(), this.deviceId = "", this.tab = "overview", this.cameras = [];
	}
	connectedCallback() {
		super.connectedCallback(), this.hass && !this._unsubRegistry && this._subscribeRegistry(this.hass);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearTimeout(this._reloadTimer);
		let e = this._unsubRegistry;
		this._unsubRegistry = void 0, e?.then((e) => e?.()).catch(() => void 0);
	}
	shouldUpdate(e) {
		return e.size === 1 && e.has("hass") && this._renderedStates !== void 0 ? jt(this._renderedStates, this.hass?.states, this._watched) : !0;
	}
	willUpdate(e) {
		(e.has("deviceId") || e.has("hass") && !this._device && !this._error) && this.hass && this._load(), e.has("hass") && this.hass && this.isConnected && !this._unsubRegistry && this._subscribeRegistry(this.hass);
	}
	updated() {
		this._renderedStates = this.hass?.states;
	}
	async reload() {
		await this._load(!0);
	}
	async _load(e = !1) {
		let t = this.hass;
		if (!t || !this.deviceId) return;
		let n = ++this._loadSeq;
		e || (this._device = void 0, this._error = void 0);
		try {
			let [e, r] = await Promise.all([Ie(t, this.deviceId), Re(t)]);
			if (n !== this._loadSeq) return;
			this._catalog = r, this._device = e, this._error = void 0, this._watched = is(e);
		} catch (e) {
			if (n !== this._loadSeq) return;
			this._error = N(e).message;
		}
	}
	_subscribeRegistry(e) {
		this._unsubRegistry = e.connection.subscribeEvents((e) => {
			let t = e.data?.entity_id;
			(!t || this._device?.connections.some((e) => e.entities.some((e) => e.entity_id === t))) && (clearTimeout(this._reloadTimer), this._reloadTimer = setTimeout(() => void this.reload(), Zo));
		}, "entity_registry_updated").catch(() => void 0);
	}
	_number(e) {
		return this.cameras.find((t) => t.id === e)?.number;
	}
	render() {
		this.renderCount += 1;
		let e = this._device, t = e?.node;
		return O`
      <div class="header">
        <button class="text with-icon back" @click=${() => {
			I(this, { view: "list" });
		}}>${P("back")}All devices</button>
      </div>
      ${this._error ? O`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : A}
      ${t ? O`<div class="title">
              ${this._number(t.id) === void 0 ? A : O`<span class="plat" aria-hidden="true">${this._number(t.id)}</span>`}
              <h1>${t.name ?? "Reolink device"}</h1>
              <p class="kind muted">${$o(e)}</p>
            </div>
            <div class="tabs" role="tablist">
              ${rs(e).map((e) => O`<button
                  role="tab"
                  aria-selected=${this.tab === e ? "true" : "false"}
                  class=${this.tab === e ? "active" : ""}
                  @click=${() => {
			I(this, {
				view: "device",
				id: this.deviceId,
				tab: e
			});
		}}
                >
                  ${es[e]}
                </button>`)}
            </div>
            ${e.degraded ? O`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>` : A}
            ${this.tab === "live" && ns(e) ? O`<rv-live-camera .hass=${this.hass} .deviceId=${t.id}></rv-live-camera>` : this.tab === "playback" && ts(e) ? O`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${t.id}
                  .cameraName=${t.name ?? ""}
                  .at=${this.at}
                ></rv-playback>` : this.tab === "overview" || this.tab === "playback" || this.tab === "live" ? O`<rv-overview
                  .hass=${this.hass}
                  .device=${e}
                  .devices=${this.devices}
                  .cameras=${this.cameras}
                ></rv-overview>` : O`<rv-settings
                  .hass=${this.hass}
                  .device=${e}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}` : this._error ? A : O`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [F, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .back {
        padding-left: 0;
      }
      .title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px 14px;
      }
      .title h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 30px;
        font-weight: 600;
        line-height: 1.1;
      }
      .kind {
        flex-basis: 100%;
        margin: 0;
        font-size: 15px;
      }
      .plat {
        min-width: 30px;
        height: 30px;
        padding: 0 5px;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        background: var(--rv-platform);
        color: var(--rv-on-rail);
        font-family: var(--rv-font-cond);
        font-size: 18px;
        font-weight: 600;
        line-height: 1;
      }
      .tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--rv-rule-strong);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .tabs button {
        min-height: 44px;
        padding: 0 14px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: var(--rv-muted);
        font-size: 16px;
        box-shadow: inset 0 -3px 0 transparent;
      }
      .tabs button:hover:not(:disabled) {
        background: transparent;
        color: var(--rv-text);
      }
      .tabs button.active {
        color: var(--rv-text);
        box-shadow: inset 0 -3px 0 var(--rv-text);
      }
      .tabs button:focus-visible {
        outline-offset: -4px;
      }
    `];
};
function $o(e) {
	let t = e.node, n = [vt(t.kind), t.model ?? void 0];
	if (t.kind === "camera" && t.connections.length > 1) {
		let e = new Set(t.connections.map((e) => e.via));
		n.push(e.has("nvr") && e.has("direct") ? "on the NVR and added directly" : `${String(t.connections.length)} connections`);
	}
	return n.filter(Boolean).join(" · ");
}
var es = {
	overview: "Overview",
	live: "Live",
	playback: "Playback",
	settings: "Settings"
};
function ts(e) {
	return e.node.kind === "camera" && e.node.connections.some((e) => e.playback_source);
}
function ns(e) {
	return e.node.kind === "camera" && !e.degraded;
}
function rs(e) {
	return [
		"overview",
		...ns(e) ? ["live"] : [],
		...ts(e) ? ["playback"] : [],
		"settings"
	];
}
function is(e) {
	let t = e.connections.flatMap((e) => e.entities.map((e) => e.entity_id));
	return e.node.kind === "camera" && e.node.snapshot_entity_id && t.push(e.node.snapshot_entity_id), t;
}
customElements.get("rv-device-page") || customElements.define("rv-device-page", Qo);
//#endregion
//#region src/types.ts
var as = [
	"sub",
	"main",
	"ext"
], os = "reolink-viewer-live-check-setup", ss = {
	sub: "Low (the live board)",
	ext: "Medium",
	main: "High (full screen)"
};
function cs(e) {
	return !/Tailscale|Nabu Casa/.test(e);
}
var ls = class extends M {
	static properties = {
		hass: { attribute: !1 },
		_status: { state: !0 },
		_cameras: { state: !0 },
		_setup: { state: !0 },
		_streams: { state: !0 },
		_warm: { state: !0 },
		_stock: { state: !0 },
		_capacity: { state: !0 },
		_camera: { state: !0 },
		_check: { state: !0 },
		_checkText: { state: !0 },
		_checkStatus: { state: !0 },
		_reports: { state: !0 },
		_error: { state: !0 },
		_copied: { state: !0 },
		_shown: { state: !0 }
	};
	_loaded = !1;
	constructor() {
		super(), this._setup = us(), this._streams = [...as], this._warm = !0, this._stock = !0, this._capacity = !0, this._camera = "", this._checkText = "", this._checkStatus = "";
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._check?.stop();
	}
	updated() {
		this.hass && !this._loaded && (this._loaded = !0, this._load());
	}
	async _load() {
		let e = this.hass;
		if (e) {
			try {
				let [t, n] = await Promise.all([nt(e), rt(e)]);
				this._status = t, this._cameras = n.cameras;
			} catch (e) {
				this._error = N(e).message;
			}
			this._loadReports();
		}
	}
	async _loadReports() {
		if (this.hass) try {
			let { reports: e } = await na(this.hass);
			this._reports = e.filter((e) => e.setup.startsWith(io));
		} catch {
			this._reports = [];
		}
	}
	get _admin() {
		return this.hass?.user?.is_admin === !0;
	}
	async runCheck(e) {
		let t = this.hass, n = this.renderRoot.querySelector(".stage");
		if (!t || !n) throw Error("the page is not ready");
		if (this._check?.running) throw Error("a check is running");
		let r = new vo(t, {
			setup: e.setup,
			streams: e.streams ?? this._streams,
			warm: e.warm ?? this._warm,
			stock: e.stock ?? this._stock,
			capacity: e.capacity ?? (this._capacity && cs(e.setup)),
			cameraIds: e.cameraIds ?? (this._camera ? [this._camera] : [])
		}, n, () => {
			this._checkText = r.text, this._checkStatus = r.plainStatus;
		});
		this._check = r, this._copied = void 0;
		try {
			return await r.run();
		} finally {
			this._checkStatus = "", this._loadReports(), this._refreshStatus();
		}
	}
	async _refreshStatus() {
		this.hass && (this._status = await nt(this.hass).catch(() => this._status));
	}
	async _copy(e, t) {
		await Zn(e) ? this._copied = t : (this._copied = void 0, this._shown = t, L(this, "Copying is blocked here: select the text instead, or copy it from Saved reports on a computer", "error"));
	}
	render() {
		let e = this._check?.running === !0;
		return O`<p class="intro">
        How quickly each camera's live video starts on this device. The check plays each camera in turn
        for a few seconds, so it takes a few minutes: keep this page open and in front. It only watches;
        it changes no camera setting.
      </p>
      <p class="muted">
        Run it on each device you use, at home and away, and compare. Each run is saved, so you can read
        it later on any device.
      </p>
      ${this._renderStatus()}
      <div class="form">
        <span class="label" id="setup">This device and network</span>
        <div class="field">
          <select
            aria-labelledby="setup"
            .value=${this._setup}
            ?disabled=${e}
            @change=${(e) => {
			this._setup = e.target.value, ds(this._setup);
		}}
          >
            ${ao.map((e) => O`<option value=${e} ?selected=${e === this._setup}>${e}</option>`)}
          </select>
        </div>
        <span class="label" id="cameras">Cameras</span>
        <div class="field">
          <select
            aria-labelledby="cameras"
            ?disabled=${e}
            @change=${(e) => {
			this._camera = e.target.value;
		}}
          >
            <option value="">All cameras</option>
            ${(this._cameras ?? []).map((e) => O`<option value=${e.id} ?selected=${e.id === this._camera}>${e.name}</option>`)}
          </select>
        </div>
        <span class="label">Video quality</span>
        <div class="field" role="group" aria-label="Video quality">
          ${as.map((t) => O`<label class="option"
              ><input
                type="checkbox"
                .checked=${this._streams.includes(t)}
                ?disabled=${e}
                @change=${(e) => {
			let n = e.target.checked;
			this._streams = as.filter((e) => e === t ? n : this._streams.includes(e));
		}}
              />${ss[t]}</label
            >`)}
        </div>
        <span class="label">Also</span>
        <div class="field stack">
          <label class="option"
            ><input
              type="checkbox"
              .checked=${this._stock}
              ?disabled=${e}
              @change=${(e) => {
			this._stock = e.target.checked;
		}}
            />Compare with Home Assistant's own camera view</label
          >
          ${this._admin ? O`<label class="option"
                  ><input
                    type="checkbox"
                    .checked=${this._warm}
                    ?disabled=${e}
                    @change=${(e) => {
			this._warm = e.target.checked;
		}}
                  />Kept warm too: how fast cameras start when their connection is kept open</label
                >
                <label class="option"
                  ><input
                    type="checkbox"
                    .checked=${this._capacity}
                    ?disabled=${e}
                    @change=${(e) => {
			this._capacity = e.target.checked;
		}}
                  />NVR capacity test: how many streams each NVR serves at once (at home only)</label
                >` : A}
        </div>
      </div>
      ${Xr(this._setup, navigator.userAgent) ? O`<div class="banner warning" role="alert">
            “${this._setup}” is for another kind of device: pick the one for this device, so the report is
            filed under it.
          </div>` : A}
      <div class="actions run">
        ${e ? O`<button @click=${() => this._check?.stop()}>Stop</button>` : O`<button
              class="primary"
              ?disabled=${!this._streams.length || !this._cameras}
              @click=${() => {
			this.runCheck({ setup: this._setup }).catch((e) => {
				this._error = N(e).message;
			});
		}}
            >
              ${this._check ? "Run it again" : "Run live check"}
            </button>`}
      </div>
      ${e && this._checkStatus ? O`<p class="progress" aria-live="polite">${this._checkStatus}…</p>` : A}
      ${this._error ? O`<div class="banner error" role="alert">${this._error}</div>` : A}
      <div class="stage" ?hidden=${!e} aria-label="Live video being measured"></div>
      ${this._check ? O`<rv-findings class="result" .summary=${this._check.inShort()}></rv-findings>` : A}
      ${this._checkText ? O`<details class="support">
            <summary>Details for support${P("chevronDown")}</summary>
            <p class="muted small">Every measurement, for a bug report or to compare devices.</p>
            <div class="actions">
              <button @click=${() => void this._copy(this._checkText, "current")}>
                ${this._copied === "current" ? "Copied" : "Copy report"}
              </button>
            </div>
            <pre class="report">${this._checkText}</pre>
          </details>` : A}
      ${this._renderReports()}`;
	}
	_renderStatus() {
		let e = this._status;
		if (!e) return A;
		let t = e.go2rtc;
		return O`<p class="small service">
        <span class="muted">Video service (go2rtc):</span>
        ${t.state}${t.version ? `, version ${t.version}` : ""}${t.error ? O` · <span class="error">${t.error}</span>` : A}
        ${t.state === "stopped" ? O`<span class="muted">(it starts with the first live video)</span>` : A}
      </p>
      ${t.log?.length ? O`<details>
            <summary class="small">Its log${P("chevronDown")}</summary>
            <pre class="report">${t.log.join("\n")}</pre>
          </details>` : A}`;
	}
	_renderReports() {
		let e = this._reports;
		return e?.length ? O`<details class="saved">
      <summary>Saved reports (${e.length})${P("chevronDown")}</summary>
      <ul class="reports">
        ${e.map((e) => O`<li>
            <div class="report-row">
              <span class="when"
                >${[
			Hn(Date.parse(e.updated), this.hass?.config?.time_zone),
			e.setup.slice(io.length),
			Pt(e.text)
		].filter(Boolean).join(" · ")}${e.done ? "" : " (not finished)"}</span
              >
              <button class="text" @click=${() => void this._copy(e.text, e.id)}>
                ${this._copied === e.id ? "Copied" : "Copy"}
              </button>
              <button
                class="text"
                aria-expanded=${this._shown === e.id ? "true" : "false"}
                @click=${() => {
			this._shown = this._shown === e.id ? void 0 : e.id;
		}}
              >
                ${this._shown === e.id ? "Hide" : "Show"}
              </button>
            </div>
            ${this._shown === e.id ? this._renderSaved(e.text) : A}
          </li>`)}
      </ul>
    </details>` : A;
	}
	_renderSaved(e) {
		let t = Qt(e);
		return t ? O`<rv-findings .summary=${t}></rv-findings>
      <details>
        <summary class="small">Details for support${P("chevronDown")}</summary>
        <pre class="report">${e}</pre>
      </details>` : O`<pre class="report">${e}</pre>`;
	}
	static styles = [F, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      p {
        margin: 0;
      }
      .intro {
        font-size: 17px;
      }
      .service {
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
      }
      .run {
        margin-top: 4px;
      }
      .progress {
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .stage[hidden] {
        display: none;
      }
      .stage {
        width: 100%;
        max-width: 480px;
        aspect-ratio: 16 / 9;
        background: var(--rv-board);
        overflow: hidden;
      }
      .stage video {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .result {
        margin-top: 6px;
      }
      details.support,
      details.saved {
        border-top: 2px solid var(--rv-rule-strong);
        padding-top: 6px;
      }
      details > p,
      details > .actions {
        margin: 6px 0 10px;
      }
      .reports {
        list-style: none;
        margin: 6px 0 0;
        padding: 0;
      }
      .reports li {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid var(--rv-rule);
      }
      .report-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
      }
      .when {
        flex: 1;
        min-width: 14em;
        font-size: 15px;
      }
      .error {
        color: var(--rv-fault-ink);
        font-weight: 600;
      }
    `];
};
function us() {
	try {
		let e = window.localStorage.getItem(os);
		if (e && ao.includes(e)) return e;
	} catch {}
	return Yr(navigator.userAgent);
}
function ds(e) {
	try {
		window.localStorage.setItem(os, e);
	} catch {}
}
customElements.get("rv-live-check") || customElements.define("rv-live-check", ls);
//#endregion
//#region src/components/live-soak.ts
var fs = "rv-live-soak-close", ps = class extends M {
	static properties = {
		hass: { attribute: !1 },
		closable: { type: Boolean },
		_state: { state: !0 },
		_confirm: { state: !0 }
	};
	constructor() {
		super(), this.closable = !1, this._state = "loading", this._confirm = !1;
	}
	_read = !1;
	connectedCallback() {
		super.connectedCallback(), this.hass && this.refresh();
	}
	updated() {
		!this._read && this.hass && this.refresh();
	}
	async refresh() {
		let e = this.hass;
		if (e) {
			this._read = !0, this._state = "loading";
			try {
				await W.flush(e);
				let t = await ct(e), n = {
					version: ro,
					now: Date.now(),
					sampleS: t.sample_s,
					keepS: t.keep_s,
					warmupS: t.warmup_s,
					startedAt: t.started_at,
					run: t.run,
					samples: t.now ? [...t.samples, t.now] : t.samples
				};
				this._state = {
					text: en(n),
					summary: tn(n)
				};
			} catch (e) {
				this._state = { error: N(e).message };
			}
		}
	}
	async _startOver() {
		let e = this.hass;
		if (this._confirm = !1, e) {
			W.discard();
			try {
				await ut(e, sn(navigator.userAgent), W.open), await this.refresh();
			} catch (e) {
				this._state = { error: N(e).message };
			}
		}
	}
	render() {
		let e = this._state, t = typeof e == "object" && "text" in e ? e : void 0;
		return O`<div class="soak" role="region" aria-label="Soak report">
      <p class="intro">
        A day-long test of live view. Home Assistant keeps watch for ${24} hours, and the live board
        counts what happens whenever it is on screen: ${8} hours in all, on any of your devices. It
        tells you whether live video kept playing, whether connections to your cameras piled up, and whether
        battery cameras slept when nobody watched.
      </p>
      ${e === "loading" ? O`<p class="muted">Reading the soak run…</p>` : "error" in e ? O`<div class="banner error" role="alert">Could not make the soak report: ${e.error}</div>` : O`<rv-findings .summary=${e.summary}></rv-findings>`}
      <div class="actions">
        <button
          class="with-icon"
          @click=${() => {
			this.refresh();
		}}
        >
          ${P("refresh")}Refresh
        </button>
        ${this._confirm ? A : O`<button
              @click=${() => {
			this._confirm = !0;
		}}
            >
              Start over…
            </button>`}
        ${this.closable ? O`<button
              @click=${() => {
			this.dispatchEvent(new CustomEvent(fs, {
				bubbles: !0,
				composed: !0
			}));
		}}
            >
              Close
            </button>` : A}
      </div>
      ${this._confirm ? O`<div class="banner warning confirm" role="alert">
            <span>Start the soak over? What was counted is dropped.</span>
            <button
              class="danger"
              @click=${() => {
			this._startOver();
		}}
            >
              Start over
            </button>
            <button
              @click=${() => {
			this._confirm = !1;
		}}
            >
              Cancel
            </button>
          </div>` : A}
      ${t ? O`<details class="support">
            <summary>Details for support${P("chevronDown")}</summary>
            <div class="actions">
              <button
                @click=${() => {
			Zn(t.text).then((e) => {
				this._state = {
					...t,
					copied: e
				};
			});
		}}
              >
                ${t.copied === void 0 ? "Copy report" : t.copied ? "Copied" : "Could not copy"}
              </button>
            </div>
            <pre class="report">${t.text}</pre>
          </details>` : A}
    </div>`;
	}
	static styles = [F, o`
      :host {
        display: block;
      }
      .soak {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .intro {
        margin: 0;
        font-size: 17px;
      }
      .confirm {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
      }
      .confirm span {
        flex: 1;
        min-width: 14em;
        font-weight: 500;
      }
      .confirm button.danger {
        background: var(--rv-on-fault);
        border-color: var(--rv-on-fault);
        color: var(--rv-fault);
      }
      details.support {
        border-top: 2px solid var(--rv-rule-strong);
        padding-top: 6px;
      }
      details.support > .actions {
        margin: 6px 0 10px;
      }
    `];
};
customElements.get("rv-live-soak") || customElements.define("rv-live-soak", ps);
//#endregion
//#region src/download.ts
function ms(e, t, n = document) {
	let r = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = n.createElement("a");
	a.href = i, a.download = t, a.rel = "noopener", n.body.appendChild(a), a.click(), a.remove(), setTimeout(() => {
		URL.revokeObjectURL(i);
	}, 1e3);
}
//#endregion
//#region src/fonts.ts
var hs = [
	[
		"Barlow",
		400,
		"barlow-400.woff2"
	],
	[
		"Barlow",
		500,
		"barlow-500.woff2"
	],
	[
		"Barlow",
		600,
		"barlow-600.woff2"
	],
	[
		"Barlow Semi Condensed",
		500,
		"barlow-semi-condensed-500.woff2"
	],
	[
		"Barlow Semi Condensed",
		600,
		"barlow-semi-condensed-600.woff2"
	]
], gs = "reolink-viewer-fonts";
function _s(e, t = document) {
	if (t.getElementById(gs)) return;
	let n = t.createElement("style");
	n.id = gs, n.textContent = hs.map(([t, n, r]) => `@font-face{font-family:"${t}";font-style:normal;font-weight:${n};font-display:swap;src:url("${new URL(`fonts/${r}`, e).href}") format("woff2");}`).join("\n"), t.head.appendChild(n);
}
//#endregion
//#region src/reolink-viewer-panel.ts
var vs = 6e3, ys = class extends M {
	static properties = {
		hass: { attribute: !1 },
		narrow: {
			type: Boolean,
			reflect: !0
		},
		_now: { state: !0 },
		_board: { state: !0 },
		_devices: { state: !0 },
		_loadError: { state: !0 },
		_probe: { state: !0 },
		_includeBattery: { state: !0 },
		_concurrency: { state: !0 },
		_maxStreams: { state: !0 },
		_playback: { state: !0 },
		_playbackOnly: { state: !0 },
		_playbackConcurrency: { state: !0 },
		_playbackStreams: { state: !0 },
		_copied: { state: !0 },
		_route: { state: !0 },
		_toast: { state: !0 }
	};
	_run;
	_loading = !1;
	_warmed = !1;
	_toastTimer;
	_clockTimer;
	_onHashChange = () => {
		this._route = Ot(window.location.hash);
	};
	constructor() {
		super(), this.narrow = !1, this._now = Date.now(), this._board = [], this._probe = { status: "idle" }, this._includeBattery = !1, this._concurrency = !1, this._maxStreams = 4, this._playback = !1, this._playbackOnly = !1, this._playbackConcurrency = !1, this._playbackStreams = 4, this._copied = !1, this._route = { view: "live" }, this.addEventListener(Tt, (e) => {
			this.navigate(e.detail);
		}), this.addEventListener(Et, (e) => {
			this.showToast(e.detail);
		});
	}
	connectedCallback() {
		super.connectedCallback(), _s(import.meta.url), this._route = Ot(window.location.hash), window.addEventListener("hashchange", this._onHashChange), this._tick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener("hashchange", this._onHashChange), clearTimeout(this._toastTimer), clearTimeout(this._clockTimer), this._run?.cancel(), this._run = void 0;
	}
	_tick() {
		this._now = Date.now(), clearTimeout(this._clockTimer), this._clockTimer = setTimeout(() => {
			this._tick();
		}, 6e4 - this._now % 6e4 + 50);
	}
	willUpdate() {
		this.toggleAttribute("dark", this.hass?.themes?.darkMode === !0);
	}
	updated(e) {
		e.has("hass") && this.hass && !this._devices && !this._loading && (this._load(), Re(this.hass).catch(() => void 0));
	}
	navigate(e) {
		let t = Dt(e);
		if (window.location.hash !== t) {
			let e = `${window.location.pathname}${window.location.search}${t}`;
			window.history.pushState(null, "", e);
		}
		e.view === "list" && this._route.view !== "list" && this._load(), this._route = e;
	}
	showToast(e) {
		clearTimeout(this._toastTimer), this._toast = e, this._toastTimer = setTimeout(() => {
			this._toast = void 0;
		}, vs);
	}
	async _load() {
		if (this.hass) {
			this._loading = !0;
			try {
				this._devices = await Fe(this.hass), this._loadError = void 0, !this._board.length && !this._devices.degraded && rt(this.hass).then(({ cameras: e }) => {
					this._board.length || (this._board = _r(e));
				}).catch(() => void 0), !this._warmed && !this._devices.degraded && (this._warmed = !0, qe(this.hass).catch(() => void 0));
			} catch (e) {
				this._loadError = N(e).message;
			} finally {
				this._loading = !1;
			}
		}
	}
	get _isAdmin() {
		return this.hass?.user?.is_admin === !0;
	}
	render() {
		let e = this._route;
		return O`
      <header class="band">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">Reolink</div>
        <nav aria-label="Reolink">
          ${this._renderTab("Live", { view: "live" }, e.view === "live")}
          ${this._renderTab("Events", { view: "events" }, e.view === "events")}
          ${this._renderTab("Devices", { view: "list" }, e.view !== "live" && e.view !== "events")}
        </nav>
        <time class="clock" aria-label="Time">
          ${K(this._now, this.hass?.config?.time_zone)}
        </time>
      </header>
      <main class=${e.view === "live" || e.view === "events" ? "wide" : "page"}>${this._renderView()}</main>
      ${this._toast ? O`<div class="toast ${this._toast.kind}" role="status" aria-live="polite">
            <span>${this._toast.message}</span>
            <button class="dismiss" aria-label="Dismiss" @click=${() => {
			this._toast = void 0;
		}}>${P("close")}</button>
          </div>` : A}
    `;
	}
	_renderTab(e, t, n) {
		return O`<button
      class="tab"
      aria-current=${n ? "page" : A}
      @click=${() => {
			this.navigate(t);
		}}
    >
      ${e}
    </button>`;
	}
	_renderView() {
		let e = this._route;
		switch (e.view) {
			case "live": return O`<rv-live-grid
            .hass=${this.hass}
            @rv-board=${(e) => {
				this._board = e.detail.cameras;
			}}
          ></rv-live-grid>
          <rv-timetable .hass=${this.hass} .cameras=${this._board} .filters=${!0}></rv-timetable>`;
			case "events": return O`<rv-events .hass=${this.hass} .cameras=${this._board} .date=${e.date}></rv-events>`;
			case "device": return O`<rv-device-page
          .hass=${this.hass}
          .cameras=${this._board}
          .devices=${this._devices}
          .deviceId=${e.id}
          .tab=${e.tab}
          .at=${e.at}
        ></rv-device-page>`;
			case "live-check": return O`${this._renderBack()}
          <h1>Live check</h1>
          <rv-live-check .hass=${this.hass}></rv-live-check>`;
			case "soak": return O`${this._renderBack()}
          <h1>Soak report</h1>
          <rv-live-soak .hass=${this.hass}></rv-live-soak>`;
			case "list": return O`<div class="heading">
            <h1>Devices</h1>
            <button class="text with-icon" @click=${() => void this._load()} ?disabled=${this._loading}>
              ${P("refresh")}Refresh
            </button>
          </div>
          ${this._renderBanner()}
          ${this._loadError ? A : O`<rv-device-list .devices=${this._devices} .cameras=${this._board}></rv-device-list>`}
          ${this._renderChecks()} ${this._isAdmin ? this._renderProbe() : A}`;
		}
	}
	_renderBack() {
		return O`<div>
      <button class="text with-icon back" @click=${() => {
			this.navigate({ view: "list" });
		}}>${P("back")}All devices</button>
    </div>`;
	}
	_renderBanner() {
		if (this._loadError) return O`<div class="banner error" role="alert">
        Could not load devices: ${this._loadError}
      </div>`;
		let e = this._devices;
		return e?.degraded ? O`<div class="banner warning" role="alert">
      <strong>Degraded mode.</strong> The Reolink integration's internals changed in this
      Home Assistant release, so only the device registry's information is shown, duplicate
      cameras are not merged and the probe is disabled. Settings still work.
      <ul>
        ${e.compat.errors.map((e) => O`<li>${e}</li>`)}
      </ul>
    </div>` : A;
	}
	_renderChecks() {
		if (!this._devices || this._devices.degraded) return A;
		let e = (e, t, n) => O`<li>
      <button
        class="row"
        @click=${() => {
			this.navigate(n);
		}}
      >
        <span class="what"><span class="name">${e}</span><span class="muted">${t}</span></span>
        ${P("chevron")}
      </button>
    </li>`;
		return O`<section class="card">
      <h2>Checks</h2>
      <p class="muted">See how well live view works on your devices, in plain words.</p>
      <ul class="checks">
        ${e("Live check", "How quickly each camera's live video starts on this device. Takes a few minutes.", { view: "live-check" })}
        ${e("Soak report", "Whether live view keeps working through a day of use: video that drops, connections that pile up, battery cameras that stay awake.", { view: "soak" })}
      </ul>
      <p class="muted small">
        To check recordings, open a camera's Playback tab, then “Details and playback check” under the
        player.
      </p>
    </section>`;
	}
	_renderProbe() {
		let e = this._probe.status === "running", t = e || !this._devices || this._devices.degraded;
		return O`<section class="card">
      <h2>Hardware probe</h2>
      <p>
        Tests which ways of getting live and recorded video work on each of your cameras, and how fast
        they are. Run it when you report a problem with a camera model: it makes a file to attach to
        your report.
      </p>
      <p class="muted">
        It only reads from your cameras and changes no settings. Passwords, addresses, serial numbers and
        other private details are left out of the file.
      </p>
      <div class="options">
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._includeBattery}
            ?disabled=${e}
            @change=${(e) => {
			this._includeBattery = e.target.checked;
		}}
          />
          <span>Include battery cameras <span class="muted">(this wakes them, which uses some battery)</span></span>
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._concurrency}
            ?disabled=${e}
            @change=${(e) => {
			this._concurrency = e.target.checked;
		}}
          />
          <span
            >Test several live streams at once: up to
            <select
              aria-label="Most live streams at once"
              .value=${String(this._maxStreams)}
              ?disabled=${e || !this._concurrency}
              @change=${(e) => {
			this._maxStreams = Number(e.target.value);
		}}
            >
              ${[
			2,
			3,
			4,
			5,
			6
		].map((e) => O`<option value=${e} ?selected=${e === this._maxStreams}>${e}</option>`)}
            </select>
            on one camera of each device, stopping at the first that fails</span
          >
        </label>
        <label class="option">
          <input
            type="checkbox"
            .checked=${this._playback}
            ?disabled=${e}
            @change=${(e) => {
			this._playback = e.target.checked;
		}}
          />
          <span>Test recordings: how they download and play, on one recent recording per camera</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._playbackOnly}
            ?disabled=${e || !this._playback}
            @change=${(e) => {
			this._playbackOnly = e.target.checked;
		}}
          />
          <span>Only test recordings (skip the live video tests)</span>
        </label>
        <label class="option nested">
          <input
            type="checkbox"
            .checked=${this._playbackConcurrency}
            ?disabled=${e || !this._playback}
            @change=${(e) => {
			this._playbackConcurrency = e.target.checked;
		}}
          />
          <span
            >Test several recordings at once: up to
            <select
              aria-label="Most recordings at once"
              .value=${String(this._playbackStreams)}
              ?disabled=${e || !this._playback || !this._playbackConcurrency}
              @change=${(e) => {
			this._playbackStreams = Number(e.target.value);
		}}
            >
              ${[
			2,
			3,
			4,
			5,
			6
		].map((e) => O`<option value=${e} ?selected=${e === this._playbackStreams}>${e}</option>`)}
            </select>
            , one per camera, stopping at the first that fails</span
          >
        </label>
      </div>
      <div class="actions">
        ${e ? O`<button @click=${() => {
			this._cancelProbe();
		}}>
              Cancel
            </button>` : O`<button class="primary" ?disabled=${t} @click=${() => {
			this._startProbe();
		}}>
              Run probe
            </button>`}
      </div>
      ${this._renderProbeState()}
    </section>`;
	}
	_renderProbeState() {
		let e = this._probe;
		switch (e.status) {
			case "idle": return A;
			case "running": return O`<div class="progress" aria-live="polite">
          <p class="now">Testing your cameras… this can take several minutes with an NVR.</p>
          ${e.log.length ? O`<p class="muted small">Now: ${e.log.at(-1)}</p>` : A}
          <details>
            <summary class="small">Every step so far${P("chevronDown")}</summary>
            <ol class="log">
              ${e.log.map((e) => O`<li>${e}</li>`)}
            </ol>
          </details>
        </div>`;
			case "error": return O`<div class="banner error" role="alert">The probe stopped: ${e.message}</div>`;
			case "done": return O`<div class="done">
          <p>
            <strong>Done.</strong> The file was saved as <code>${e.filename}</code>. Attach it to your
            report. If your browser or the Companion app blocked the download, copy it instead.
          </p>
          <div class="actions">
            <button @click=${() => {
				ms(e.report, e.filename);
			}}>
              Download again
            </button>
            <button @click=${() => void this._copy(e.report)}>
              ${this._copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <details>
            <summary class="small">Show what is in the file${P("chevronDown")}</summary>
            <pre class="report">${JSON.stringify(e.report, null, 2)}</pre>
          </details>
        </div>`;
		}
	}
	_startProbe() {
		if (!this.hass) return;
		let e = [];
		this._copied = !1, this._probe = {
			status: "running",
			started: Date.now(),
			log: e
		};
		let t = Be(this.hass, {
			include_battery: this._includeBattery,
			concurrency_test: this._concurrency,
			max_streams: this._maxStreams,
			playback_test: this._playback,
			playback_only: this._playback && this._playbackOnly,
			playback_concurrency_test: this._playback && this._playbackConcurrency,
			playback_max_streams: this._playbackStreams
		}, (e) => {
			this._probe.status === "running" && (this._probe = {
				...this._probe,
				log: [...this._probe.log, e].slice(-8)
			});
		});
		this._run = t, t.result.then((e) => {
			if (this._run !== t) return;
			this._run = void 0;
			let n = St(/* @__PURE__ */ new Date());
			this._probe = {
				status: "done",
				report: e,
				filename: n
			}, ms(e, n);
		}, (e) => {
			this._run === t && (this._run = void 0, this._probe = {
				status: "error",
				message: N(e).message
			});
		});
	}
	_cancelProbe() {
		let e = this._run;
		this._run = void 0, e?.cancel(), this._probe = { status: "idle" };
	}
	async _copy(e) {
		try {
			await navigator.clipboard.writeText(JSON.stringify(e, null, 2)), this._copied = !0;
		} catch {
			this._copied = !1;
		}
	}
	static styles = [
		wt,
		F,
		o`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        min-height: 100dvh;
        background: var(--rv-ground);
        color: var(--rv-text);
        -webkit-font-smoothing: antialiased;
      }
      /* The band: where you are, and the time. */
      .band {
        display: flex;
        align-items: stretch;
        gap: 24px;
        height: 64px;
        padding: 0 20px;
        background: var(--rv-rail);
        color: var(--rv-on-rail);
        box-sizing: border-box;
        flex: none;
      }
      ha-menu-button {
        align-self: center;
      }
      .title {
        display: flex;
        align-items: center;
        font-family: var(--rv-font-cond);
        font-size: 22px;
        font-weight: 600;
      }
      nav {
        display: flex;
      }
      .tab {
        min-height: 0;
        padding: 0 14px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: var(--rv-on-rail-muted);
        font-size: 16px;
        box-shadow: inset 0 -3px 0 transparent;
      }
      .tab:hover:not(:disabled) {
        background: transparent;
        color: var(--rv-on-rail);
      }
      .tab[aria-current] {
        color: var(--rv-on-rail);
        box-shadow: inset 0 -3px 0 var(--rv-on-rail);
      }
      .tab:focus-visible {
        outline-color: var(--rv-on-rail);
        outline-offset: -6px;
      }
      .clock {
        margin-left: auto;
        align-self: center;
        font-family: var(--rv-font-cond);
        font-size: 30px;
        font-weight: 600;
        line-height: 1;
      }
      :host([narrow]) .band {
        flex-wrap: wrap;
        height: auto;
        gap: 0;
        padding: 0 16px 0 4px;
      }
      :host([narrow]) .title {
        height: 56px;
        font-size: 20px;
        padding-left: 8px;
      }
      :host([narrow]) nav {
        order: 3;
        width: 100%;
        height: 44px;
      }
      :host([narrow]) .tab {
        flex: 1;
        font-size: 15px;
      }
      :host([narrow]) .clock {
        font-size: 24px;
      }
      main {
        flex: 1;
        min-width: 0;
      }
      main.page {
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        padding: 20px 24px 40px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      :host([narrow]) main.page {
        padding: 14px 16px 32px;
      }
      main.page > * {
        min-width: 0;
      }
      h1 {
        margin: 0;
        font-family: var(--rv-font-cond);
        font-size: 28px;
        font-weight: 600;
        line-height: 1.1;
      }
      .heading {
        display: flex;
        align-items: baseline;
        gap: 16px;
      }
      .back {
        padding-left: 0;
      }
      .checks {
        list-style: none;
        margin: 10px 0 12px;
        padding: 0;
        border-top: 1px solid var(--rv-rule-strong);
      }
      .checks li {
        border-bottom: 1px solid var(--rv-rule);
      }
      .checks .row {
        display: flex;
        align-items: center;
        gap: 16px;
        width: 100%;
        min-height: 64px;
        padding: 10px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: inherit;
        text-align: left;
        font-weight: 400;
      }
      .checks .row:hover:not(:disabled) {
        background: var(--rv-ground-2);
      }
      .checks .row:focus-visible {
        outline-offset: -2px;
      }
      .checks .what {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .checks .name {
        font-size: 17px;
        font-weight: 600;
      }
      .checks .row svg {
        flex: none;
        width: 18px;
        height: 18px;
        color: var(--rv-muted);
      }
      .card > p {
        margin: 6px 0;
      }
      .options {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 12px 0 14px;
      }
      .options select {
        margin: -4px 4px 0;
        padding: 2px 6px;
      }
      .progress .now {
        font-family: var(--rv-font-cond);
        font-size: 19px;
        font-weight: 600;
      }
      .progress,
      .done {
        margin-top: 14px;
      }
      .done .actions {
        margin: 10px 0;
      }
      .log {
        margin: 6px 0 0;
        padding-left: 22px;
        color: var(--rv-muted);
        font-family: var(--rv-mono);
        font-size: 13px;
      }
      .toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 20;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: min(560px, calc(100vw - 32px));
        padding: 8px 8px 8px 16px;
        background: var(--rv-board);
        color: var(--rv-on-board);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
      }
      .toast.error {
        background: var(--rv-fault);
        color: var(--rv-on-fault);
      }
      .toast .dismiss {
        min-height: 0;
        padding: 6px;
        border: none;
        background: transparent;
        color: inherit;
      }
    `
	];
};
customElements.get("reolink-viewer-panel") || customElements.define("reolink-viewer-panel", ys);
//#endregion
export { ys as ReolinkViewerPanel };
