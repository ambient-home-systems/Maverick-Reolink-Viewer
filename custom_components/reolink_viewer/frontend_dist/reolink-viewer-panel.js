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
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: ee } = Object, m = globalThis, h = m.trustedTypes, te = h ? h.emptyScript : "", ne = m.reactiveElementPolyfillSupport, g = (e, t) => e, _ = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? te : null;
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
}, v = (e, t) => !l(e, t), re = {
	attribute: !0,
	type: String,
	converter: _,
	reflect: !1,
	useDefault: !1,
	hasChanged: v
};
Symbol.metadata ??= Symbol("metadata"), m.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var y = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = re) {
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
		return this.elementProperties.get(e) ?? re;
	}
	static _$Ei() {
		if (this.hasOwnProperty(g("elementProperties"))) return;
		let e = ee(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(g("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(g("properties"))) {
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
			let i = (n.converter?.toAttribute === void 0 ? _ : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? _ : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? v)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
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
y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[g("elementProperties")] = /* @__PURE__ */ new Map(), y[g("finalized")] = /* @__PURE__ */ new Map(), ne?.({ ReactiveElement: y }), (m.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var b = globalThis, ie = (e) => e, x = b.trustedTypes, S = x ? x.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, C = "$lit$", w = `lit$${Math.random().toFixed(9).slice(2)}$`, T = "?" + w, ae = `<${T}>`, E = document, D = () => E.createComment(""), O = (e) => e === null || typeof e != "object" && typeof e != "function", k = Array.isArray, oe = (e) => k(e) || typeof e?.[Symbol.iterator] == "function", A = "[ 	\n\f\r]", j = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, se = /-->/g, ce = />/g, M = RegExp(`>|${A}(?:([^\\s"'>=/]+)(${A}*=${A}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), N = /'/g, le = /"/g, ue = /^(?:script|style|textarea|title)$/i, P = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), F = Symbol.for("lit-noChange"), I = Symbol.for("lit-nothing"), de = /* @__PURE__ */ new WeakMap(), L = E.createTreeWalker(E, 129);
function R(e, t) {
	if (!k(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return S === void 0 ? t : S.createHTML(t);
}
var fe = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = j;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === j ? c[1] === "!--" ? o = se : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = M) : (ue.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = M) : o = ce : o === M ? c[0] === ">" ? (o = i ?? j, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? M : c[3] === "\"" ? le : N) : o === le || o === N ? o = M : o === se || o === ce ? o = j : (o = M, i = void 0);
		let d = o === M && e[t + 1].startsWith("/>") ? " " : "";
		a += o === j ? n + ae : l >= 0 ? (r.push(s), n.slice(0, l) + C + n.slice(l) + w + d) : n + w + (l === -2 ? t : d);
	}
	return [R(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, z = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = fe(t, n);
		if (this.el = e.createElement(l, r), L.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = L.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(C)) {
					let t = u[o++], n = i.getAttribute(e).split(w), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? me : r[1] === "?" ? he : r[1] === "@" ? ge : H
					}), i.removeAttribute(e);
				} else e.startsWith(w) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (ue.test(i.tagName)) {
					let e = i.textContent.split(w), t = e.length - 1;
					if (t > 0) {
						i.textContent = x ? x.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], D()), L.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], D());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === T) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(w, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += w.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = E.createElement("template");
		return n.innerHTML = e, n;
	}
};
function B(e, t, n = e, r) {
	if (t === F) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = O(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = B(e, i._$AS(e, t.values), i, r)), t;
}
var pe = class {
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? E).importNode(t, !0);
		L.currentNode = r;
		let i = L.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new V(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new _e(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = L.nextNode(), a++);
		}
		return L.currentNode = E, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, V = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = I, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
		e = B(this, e, t), O(e) ? e === I || e == null || e === "" ? (this._$AH !== I && this._$AR(), this._$AH = I) : e !== this._$AH && e !== F && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? oe(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== I && O(this._$AH) ? this._$AA.nextSibling.data = e : this.T(E.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = z.createElement(R(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new pe(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = de.get(e.strings);
		return t === void 0 && de.set(e.strings, t = new z(e)), t;
	}
	k(t) {
		k(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(D()), this.O(D()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = ie(e).nextSibling;
			ie(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, H = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = I, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = I;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = B(this, e, t, 0), a = !O(e) || e !== this._$AH && e !== F, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = B(this, r[n + o], t, o), s === F && (s = this._$AH[o]), a ||= !O(s) || s !== this._$AH[o], s === I ? e = I : e !== I && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === I ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, me = class extends H {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === I ? void 0 : e;
	}
}, he = class extends H {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== I);
	}
}, ge = class extends H {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = B(this, e, t, 0) ?? I) === F) return;
		let n = this._$AH, r = e === I && n !== I || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== I && (n === I || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, _e = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		B(this, e);
	}
}, ve = b.litHtmlPolyfillSupport;
ve?.(z, V), (b.litHtmlVersions ??= []).push("3.3.3");
var ye = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new V(t.insertBefore(D(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, U = globalThis, W = class extends y {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = ye(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return F;
	}
};
W._$litElement$ = !0, W.finalized = !0, U.litElementHydrateSupport?.({ LitElement: W });
var be = U.litElementPolyfillSupport;
be?.({ LitElement: W }), (U.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region src/api.ts
var xe = (e) => e.callWS({ type: "reolink_viewer/devices" }), Se = (e, t) => e.callWS({
	type: "reolink_viewer/device",
	device_id: t
}), G = /* @__PURE__ */ new WeakMap();
function Ce(e) {
	let t = G.get(e.connection);
	return t || (t = e.callWS({ type: "reolink_viewer/catalog" }), G.set(e.connection, t), t.catch(() => G.delete(e.connection))), t;
}
var we = (e, t) => e.callWS({
	type: "config/entity_registry/update",
	entity_id: t,
	disabled_by: null
});
function Te(e, t, n) {
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
				i = !0, c(K(e));
			});
		}),
		cancel: () => {
			i || (i = !0, o(), a(/* @__PURE__ */ Error("Probe cancelled")));
		}
	};
}
function K(e) {
	return e instanceof Error ? e : typeof e == "object" && e && "message" in e ? Error(String(e.message)) : Error(String(e));
}
//#endregion
//#region src/format.ts
var Ee = {
	camera: "Camera",
	nvr: "NVR",
	hub: "Home Hub"
}, q = (e) => Ee[e];
function De(e) {
	let t = [];
	return e.codec && t.push(Oe(e.codec)), e.frame_rate && t.push(`${e.frame_rate} fps`), e.bit_rate && t.push(`${e.bit_rate} kbps`), t.length ? t.join(" · ") : "unknown";
}
function Oe(e) {
	switch (e.toLowerCase()) {
		case "h264": return "H.264";
		case "h265":
		case "hevc": return "H.265";
		default: return e;
	}
}
function J(e) {
	return e === null ? "unknown" : e ? "on" : "off";
}
function ke(e) {
	return `reolink-viewer-probe-${e.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
}
//#endregion
//#region src/styles.ts
var Y = o`
  :host {
    color: var(--primary-text-color);
  }
  .card {
    overflow-wrap: anywhere;
    background: var(--card-background-color, white);
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, none);
    border: 1px solid var(--divider-color, #e0e0e0);
    padding: 16px;
  }
  h2 {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 500;
  }
  h3 {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 500;
  }
  .muted {
    color: var(--secondary-text-color);
  }
  .small {
    font-size: 13px;
  }
  .badge {
    display: inline-block;
    font-size: 12px;
    line-height: 18px;
    padding: 0 8px;
    border-radius: 9px;
    background: var(--secondary-background-color, #eee);
    color: var(--primary-text-color);
    white-space: nowrap;
  }
  .badge.accent {
    background: var(--primary-color);
    color: var(--text-primary-color, white);
  }
  .badge.warning {
    background: var(--warning-color, #ffa600);
    color: var(--text-primary-color, black);
  }
  button {
    font: inherit;
    padding: 6px 14px;
    border-radius: 4px;
    border: 1px solid var(--divider-color, #ccc);
    background: var(--card-background-color, white);
    color: var(--primary-text-color);
    cursor: pointer;
  }
  button.primary {
    background: var(--primary-color);
    color: var(--text-primary-color, white);
    border-color: var(--primary-color);
  }
  button.danger {
    background: var(--error-color, #db4437);
    color: var(--text-primary-color, white);
    border-color: var(--error-color, #db4437);
  }
  button.text {
    background: transparent;
    color: inherit;
    border: none;
  }
  button.link {
    background: none;
    border: none;
    padding: 0;
    color: var(--primary-color);
    text-align: left;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  input,
  select {
    font: inherit;
    color: var(--primary-text-color);
    background: var(--card-background-color, white);
    border: 1px solid var(--divider-color, #ccc);
    border-radius: 4px;
    padding: 4px 6px;
  }
  a {
    color: var(--primary-color);
  }
  .banner {
    padding: 12px 16px;
    border-radius: 8px;
  }
  .banner.warning {
    background: var(--warning-color, #ffa600);
    color: var(--text-primary-color, black);
  }
  .banner.error {
    background: var(--error-color, #db4437);
    color: var(--text-primary-color, white);
  }
  .banner.info {
    background: var(--secondary-background-color, #f0f0f0);
  }
  dl.facts {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 8px 0;
    font-size: 14px;
  }
  dl.facts dt {
    color: var(--secondary-text-color);
  }
  dl.facts dd {
    margin: 0;
  }
`, Ae = "rv-navigate", je = "rv-toast";
function X(e, t) {
	e.dispatchEvent(new CustomEvent(Ae, {
		detail: t,
		bubbles: !0,
		composed: !0
	}));
}
function Z(e, t, n = "info") {
	e.dispatchEvent(new CustomEvent(je, {
		detail: {
			message: t,
			kind: n
		},
		bubbles: !0,
		composed: !0
	}));
}
function Me(e) {
	return e.view === "list" ? "" : `#device/${encodeURIComponent(e.id)}/${e.tab}`;
}
function Ne(e) {
	let t = /^#device\/([^/]+)(?:\/(overview|settings))?$/.exec(e);
	return t?.[1] ? {
		view: "device",
		id: decodeURIComponent(t[1]),
		tab: t[2] === "settings" ? "settings" : "overview"
	} : { view: "list" };
}
//#endregion
//#region src/components/device-list.ts
var Pe = class extends W {
	static properties = { devices: { attribute: !1 } };
	render() {
		let e = this.devices;
		if (!e) return P`<p class="muted">Loading devices…</p>`;
		if (!e.hosts.length && !e.cameras.length) return P`<section class="card">
        <h2>No Reolink devices</h2>
        <p class="muted">
          Set up your cameras, NVRs or Home Hubs in the Reolink integration first; they appear
          here once loaded.
        </p>
      </section>`;
		let t = new Map(e.cameras.map((e) => [e.id, e])), n = e.cameras.filter((e) => e.host_id === null);
		return P`
      ${e.hosts.map((e) => this._renderHost(e, t))}
      ${n.length ? P`<section class="card">
            <h2>Cameras added directly</h2>
            <ul class="devices">
              ${n.map((e) => this._renderCamera(e))}
            </ul>
          </section>` : I}
    `;
	}
	_renderHost(e, t) {
		let n = e.camera_ids.map((e) => t.get(e)).filter((e) => e !== void 0);
		return P`<section class="card">
      <div class="host-header">
        <button class="link title" @click=${() => {
			X(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}>
          ${e.name ?? e.entry_title}
        </button>
        <span class="badge">${q(e.kind)}</span>
      </div>
      <p class="muted small">
        ${[e.model, e.sw_version && `firmware ${e.sw_version}`].filter(Boolean).join(" · ")}
      </p>
      ${n.length ? P`<ul class="devices">
            ${n.map((t) => this._renderCamera(t, e))}
          </ul>` : P`<p class="muted">No cameras on this ${q(e.kind)}.</p>`}
    </section>`;
	}
	_renderCamera(e, t) {
		let n = t ? e.connections.find((e) => e.host_id === t.id)?.channel : void 0, r = t !== void 0 && e.connections.some((e) => e.via === "direct");
		return P`<li>
      <button
        class="row"
        @click=${() => {
			X(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}
      >
        <span class="name">
          ${n == null ? I : P`<span class="muted">Ch ${n + 1}</span> `}${e.name ?? "Camera"}
        </span>
        <span class="muted small">${e.model ?? ""}</span>
        <span class="badges">
          ${Fe(e)}
          ${r ? P`<span class="badge" title="Also added to Home Assistant directly"
                >+ direct</span
              >` : I}
          ${e.primary_view === "snapshot" ? P`<span class="badge" title="Does not record: snapshots are its main view"
                >snapshots</span
              >` : I}
        </span>
      </button>
    </li>`;
	}
	static styles = [Y, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .host-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title {
        font-size: 18px;
        font-weight: 500;
      }
      ul.devices {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
      }
      ul.devices li + li {
        border-top: 1px solid var(--divider-color, #e0e0e0);
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 4px;
        border: none;
        border-radius: 0;
        background: transparent;
        text-align: left;
      }
      .row:hover {
        background: var(--secondary-background-color, #f5f5f5);
      }
      .badges {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      @media (max-width: 600px) {
        .row {
          grid-template-columns: 1fr auto;
        }
        .row > .small {
          display: none;
        }
      }
    `];
};
function Fe(e) {
	let t = e.status;
	return t.online === !1 ? P`<span class="badge warning">offline</span>` : t.sleeping ? P`<span class="badge">sleeping</span>` : I;
}
customElements.get("rv-device-list") || customElements.define("rv-device-list", Pe);
//#endregion
//#region src/render-filter.ts
function Ie(e, t, n) {
	if (e === t) return !1;
	if (!e || !t) return !0;
	for (let r of n) if (e[r] !== t[r]) return !0;
	return !1;
}
//#endregion
//#region src/catalog.ts
var Le = {
	id: "other",
	title: "Other",
	description: "Entities this version of Reolink Viewer does not know yet."
};
function Q(e, t, n) {
	if (e && n !== null) return e.entities[t]?.[n];
}
function Re(e, t) {
	let n = t.indexOf(".");
	if (!(n < 0)) return Q(e, t.slice(0, n), t.slice(n + 1));
}
function ze(e) {
	return [...e?.categories ?? [], Le];
}
function Be(e, t) {
	if (e?.impact !== "disruptive") return null;
	let n = e.disruptive_when ?? "any", r;
	return r = Array.isArray(n) ? typeof t == "object" && n.includes(t.option) : n === "any" || t === n, r ? e.impact_note ?? "This action can disrupt the camera." : null;
}
function Ve(e, t) {
	return e.name ?? t?.title ?? e.entity_id;
}
var He = (e) => e.toLowerCase();
function Ue(e, t, n) {
	let r = He(n).split(/\s+/).filter(Boolean);
	if (!r.length) return !0;
	let i = He([
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
function We(e, t) {
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
function Ge(e) {
	return {
		domain: "light",
		service: "turn_on",
		data: { brightness_pct: e }
	};
}
//#endregion
//#region src/writes.ts
var Ke = 1e4, qe = class {
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
}, Je = 1, Ye = class extends W {
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
	writes = new qe();
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
			let e = Q(this.catalog, n.domain, n.key);
			if (!Ue(n, e, this._search)) continue;
			let r = t.get(n.category) ?? [];
			r.push({
				entity: n,
				entry: e,
				label: Ve(n, e)
			}), t.set(n.category, r);
		}
		for (let e of t.values()) e.sort((e, t) => e.label.localeCompare(t.label));
		return t;
	}
	render() {
		let e = this.connection;
		if (!this.device || !e) return P`<p class="muted">No settings.</p>`;
		let t = this._rows(e), n = e.entities.filter((e) => e.disabled_by !== null).length, r = ze(this.catalog).filter((e) => t.has(e.id));
		return P`
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
      ${this._showDisabled ? P`<p class="banner info small">
            Home Assistant creates some Reolink entities disabled.
            ${this.hass?.user?.is_admin ? "Enabling one makes Home Assistant reload the Reolink integration entry for this device after about 30 seconds; its entities are briefly unavailable and the new one appears then." : "An administrator can enable them."}
          </p>` : I}
      ${r.length ? r.map((e) => P`<section class="category">
              <h3>${e.title}</h3>
              <p class="muted small">${e.description}</p>
              <ul class="rows">
                ${(t.get(e.id) ?? []).map((e) => this._renderRow(e))}
              </ul>
            </section>`) : P`<p class="muted">No settings match “${this._search}”.</p>`}
      ${this._renderConfirm()}
    `;
	}
	_renderConnections() {
		let e = this.device?.connections ?? [];
		if (e.length < 2) return I;
		let t = this.connection;
		return P`<div class="connections" role="radiogroup" aria-label="Settings via">
      <span class="small muted">Settings via</span>
      ${e.map((e, n) => P`<button
          role="radio"
          aria-checked=${e === t ? "true" : "false"}
          class=${e === t ? "primary" : ""}
          @click=${() => {
			this._connection = n;
		}}
        >
          ${Xe(e)} (${e.entities.length})
        </button>`)}
      <span class="small muted">
        Both connections reach the same camera; a change made through either applies to it.
      </span>
    </div>`;
	}
	_renderRow(e) {
		let { entity: t, entry: n, label: r } = e, i = this._open.has(t.entity_id);
		return P`<li class="row" data-entity-id=${t.entity_id}>
      <div class="info">
        <div class="label">
          ${r}
          ${t.sub_device ? P`<span class="badge">${t.sub_device}</span>` : I}
          ${t.disabled_by === null ? I : P`<span class="badge">disabled</span>`}
          ${t.hidden_by === null ? I : P`<span class="badge">hidden</span>`}
          ${t.entity_category === "diagnostic" ? P`<span class="badge">diagnostic</span>` : I}
          ${n?.impact === "disruptive" ? P`<span class="badge warning" title=${n.impact_note ?? ""}>disruptive</span>` : I}
        </div>
        ${n ? P`<div class="muted small">${n.summary}</div>` : I}
      </div>
      <div class="control">${this._renderControl(t, r)}</div>
      ${n ? P`<details
            class="about"
            .open=${i}
            @toggle=${(e) => {
			this._setOpen(t.entity_id, e.target.open);
		}}
          >
            <summary class="small">About this setting</summary>
            ${i ? this._renderAbout(n) : I}
          </details>` : I}
    </li>`;
	}
	_setOpen(e, t) {
		if (this._open.has(e) === t) return;
		let n = new Set(this._open);
		t ? n.add(e) : n.delete(e), this._open = n;
	}
	_renderAbout(e) {
		let t = e.related.map((e) => Re(this.catalog, e)?.title).filter((e) => e !== void 0);
		return P`<div class="about-body small">
      ${e.verification === "unverified" ? P`<p class="unverified">
            <span class="badge warning">unverified</span> Reolink does not document exactly what
            this does; the text says only what is known.
          </p>` : I}
      <p>${e.what_it_does}</p>
      ${e.tradeoffs ? P`<p><strong>Trade-offs:</strong> ${e.tradeoffs}</p>` : I}
      ${e.impact === "disruptive" ? P`<p><strong>Impact:</strong> ${e.impact_note}</p>` : I}
      <p><strong>Requires:</strong> ${e.requires}</p>
      ${e.notes ? P`<p>${e.notes}</p>` : I}
      ${t.length ? P`<p><strong>Related:</strong> ${t.join(", ")}</p>` : I}
      <p>
        <strong>Sources:</strong>
        ${e.sources.map((e, t) => P`${t ? ", " : ""}<a href=${e.url} target="_blank" rel="noreferrer"
              >${e.title}</a
            >`)}
      </p>
    </div>`;
	}
	_renderControl(e, t) {
		if (e.disabled_by !== null) {
			if (!this.hass?.user?.is_admin) return P`<span class="muted small">Disabled</span>`;
			let n = this._enabling.has(e.entity_id);
			return P`<button ?disabled=${n} @click=${() => void this._enable(e, t)}>
        ${n ? "Enabling…" : "Enable"}
      </button>`;
		}
		let n = this.hass?.states[e.entity_id];
		if (!n) return P`<span class="muted small">Not loaded yet</span>`;
		let r = e.entity_id, i = this.writes.isPending(r), a = this.writes.valueFor(r), o = n.state === "unavailable" || i;
		switch (e.domain) {
			case "switch":
			case "siren": return this._toggle(e, t, a ?? n.state === "on", o && !i);
			case "light": return this._light(e, t, n, a, o && !i);
			case "number": return this._number(e, t, n, a, o);
			case "select": return this._select(e, t, n, a, o);
			case "time": return P`<input
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
			case "button": return P`<button
          ?disabled=${o}
          @click=${() => void this._write(e, t, "press", "any")}
        >
          ${i ? "Pressing…" : "Press"}
        </button>`;
			case "update": return this._update(e, t, n, i);
			default: return P`<span class="value">${Ze(n, e.domain)}</span>`;
		}
	}
	_toggle(e, t, n, r) {
		let i = n === !0;
		return P`<button
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
		return P`<span class="light">
      ${o && l ? P`<input
            type="range"
            min="1"
            max="100"
            aria-label="${t} brightness"
            .value=${String(typeof r == "number" ? r : c)}
            ?disabled=${i}
            @change=${(n) => {
			let r = Number(n.target.value);
			this._write(e, t, r, "on", Ge(r));
		}}
          />` : I}
      ${this._toggle(e, t, l, i)}
    </span>`;
	}
	_number(e, t, n, r, i) {
		let a = n.attributes, o = $(a.min, 0), s = $(a.max, 100), c = $(a.step, 1), l = typeof a.unit_of_measurement == "string" ? a.unit_of_measurement : "", u = Number(n.state), d = typeof r == "number" ? r : u, f = Number.isFinite(d) ? String(d) : "", p = (n) => {
			let r = n.target, i = Number(r.value);
			r.value === "" || !Number.isFinite(i) || i < o || i > s ? r.value = f : i !== d && this._write(e, t, i, "any");
		};
		return P`<span class="number">
      ${a.mode === "box" ? I : P`<input
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
      ${l ? P`<span class="unit muted small">${l}</span>` : I}
    </span>`;
	}
	_select(e, t, n, r, i) {
		let a = Array.isArray(n.attributes.options) ? n.attributes.options.map(String) : [], o = typeof r == "string" ? r : n.state;
		return P`<select
      aria-label=${t}
      ?disabled=${i}
      @change=${(n) => {
			let r = n.target, i = r.value;
			r.value = o, this._write(e, t, i, { option: i });
		}}
    >
      ${a.includes(o) ? I : P`<option value="" selected>—</option>`}
      ${a.map((e) => P`<option value=${e} ?selected=${e === o}>${e}</option>`)}
    </select>`;
	}
	_update(e, t, n, r) {
		let i = n.attributes, a = typeof i.installed_version == "string" ? i.installed_version : "?", o = typeof i.latest_version == "string" ? i.latest_version : null, s = typeof i.supported_features == "number" ? i.supported_features : 0, c = i.in_progress === !0 || r, l = n.state === "on" && (s & Je) !== 0;
		return P`<span class="update small">
      <span>
        ${a}${o && o !== a ? P` → <strong>${o}</strong>` : I}
        ${n.state === "off" ? P`<span class="muted">(up to date)</span>` : I}
      </span>
      ${l || c ? P`<button
            ?disabled=${c}
            @click=${() => void this._write(e, t, "install", "any")}
          >
            ${c ? "Installing…" : "Install"}
          </button>` : I}
    </span>`;
	}
	async _write(e, t, n, r, i) {
		let a = this.hass;
		if (!a) return;
		let o = Be(Q(this.catalog, e.domain, e.key), r);
		if (o !== null && !await this.confirm(t, o)) return;
		let s = i ?? We(e.domain, e.domain === "button" ? "press" : e.domain === "update" ? "install" : n), c = e.entity_id, l = this.writes.begin(c, n, a.states[c]);
		this.requestUpdate();
		try {
			await a.callService(s.domain, s.service, s.data, { entity_id: c }, !1), this.writes.confirm(c, l), this._scheduleSettle();
		} catch (e) {
			this.writes.fail(c, l) && Z(this, `Could not change ${t}: ${K(e).message}`, "error");
		}
		this.requestUpdate();
	}
	_scheduleSettle() {
		clearTimeout(this._settleTimer), this._settleTimer = setTimeout(() => {
			this.hass && this.writes.settle(this.hass.states) && this.requestUpdate(), this.writes.size && this._scheduleSettle();
		}, Ke + 100);
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
		return e ? P`<div class="scrim" @click=${() => {
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
    </div>` : I;
	}
	async _enable(e, t) {
		let n = this.hass;
		if (n) {
			this._enabling = /* @__PURE__ */ new Set([...this._enabling, e.entity_id]);
			try {
				let r = (await we(n, e.entity_id)).reload_delay;
				Z(this, `${t} enabled. Home Assistant reloads the Reolink entry${r ? ` in about ${r} seconds` : ""}; the entity becomes available after that.`), this.dispatchEvent(new CustomEvent("rv-entity-enabled", {
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				Z(this, `Could not enable ${t}: ${K(e).message}`, "error");
			} finally {
				let t = new Set(this._enabling);
				t.delete(e.entity_id), this._enabling = t;
			}
		}
	}
	static styles = [Y, o`
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
      .category {
        background: var(--card-background-color, white);
        border-radius: var(--ha-card-border-radius, 12px);
        border: 1px solid var(--divider-color, #e0e0e0);
        padding: 12px 16px;
      }
      ul.rows {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px 12px;
        align-items: center;
        padding: 8px 0;
        border-top: 1px solid var(--divider-color, #e0e0e0);
      }
      .label {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .control {
        justify-self: end;
      }
      .about {
        grid-column: 1 / -1;
      }
      .about summary {
        cursor: pointer;
        color: var(--primary-color);
        width: max-content;
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
        accent-color: var(--primary-color);
      }
      .box {
        width: 72px;
      }
      .toggle {
        position: relative;
        width: 40px;
        height: 22px;
        padding: 0;
        border-radius: 11px;
        border: none;
        background: var(--switch-unchecked-track-color, var(--disabled-color, #bdbdbd));
      }
      .toggle .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--switch-unchecked-button-color, white);
        transition: left 0.15s;
      }
      .toggle.on {
        background: var(--switch-checked-track-color, var(--primary-color));
      }
      .toggle.on .knob {
        left: 21px;
        background: var(--switch-checked-button-color, white);
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
        background: rgba(0, 0, 0, 0.4);
      }
      .dialog {
        max-width: 420px;
        margin: 16px;
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
function Xe(e) {
	return e.via === "nvr" ? `NVR (${e.host_name ?? e.entry_title})` : "Direct";
}
function $(e, t) {
	return typeof e == "number" && Number.isFinite(e) ? e : t;
}
function Ze(e, t) {
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
customElements.get("rv-settings") || customElements.define("rv-settings", Ye);
//#endregion
//#region src/components/overview.ts
var Qe = 3e4, $e = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, et = class extends W {
	static properties = {
		hass: { attribute: !1 },
		device: { attribute: !1 },
		_stamp: { state: !0 }
	};
	_timer;
	constructor() {
		super(), this._stamp = 0;
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
		}, Qe));
	}
	snapshotUrl() {
		let e = this.device?.node;
		if (e?.kind !== "camera" || !e.snapshot_entity_id) return null;
		let t = this.hass?.states[e.snapshot_entity_id]?.attributes.entity_picture;
		return typeof t != "string" || !t ? null : this._stamp ? `${t}${t.includes("?") ? "&" : "?"}_=${this._stamp}` : t;
	}
	render() {
		let e = this.device;
		if (!e) return P``;
		let t = e.node;
		return P`
      ${t.kind === "camera" ? this._renderSnapshot(t) : this._renderCameras()}
      ${e.connections.map((t) => this._renderConnection(t, e))}
    `;
	}
	_renderSnapshot(e) {
		let t = this.snapshotUrl(), n = e.primary_view === "snapshot";
		return P`<section class="card snapshot ${n ? "primary" : ""}">
      <div class="header">
        <h2>Latest snapshot</h2>
        <button
          ?disabled=${!t}
          @click=${() => {
			this._stamp = Date.now();
		}}
        >
          Refresh
        </button>
      </div>
      ${n ? P`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${Qe / 1e3} seconds while this page is open.
          </p>` : I}
      ${t ? P`<img src=${t} alt="Latest snapshot of ${e.name ?? "the camera"}" />` : P`<p class="muted">
            No snapshot: enable one of this camera's stream entities (for example
            <em>Fluent</em>) in the Settings tab.
          </p>`}
    </section>`;
	}
	_renderCameras() {
		let e = this.device?.node;
		return e?.kind === "camera" ? I : P`<section class="card">
      <h2>${q(e?.kind ?? "nvr")}</h2>
      <p class="muted small">${e?.camera_ids.length ?? 0} cameras; open one from the list.</p>
      <button class="link" @click=${() => {
			X(this, { view: "list" });
		}}>All devices</button>
    </section>`;
	}
	_renderConnection(e, t) {
		let n = e.details, r = t.node.kind === "camera";
		return P`<section class="card">
      <div class="header">
        <h2>${r ? Xe(e) : "Device"}</h2>
        ${e.playback_source ? P`<span class="badge accent">playback source</span>` : I}
        ${e.channel !== void 0 && e.channel !== null && e.via === "nvr" ? P`<span class="badge">channel ${e.channel + 1}</span>` : I}
      </div>
      ${n === null ? P`<p class="muted">
            Details are unavailable${t.degraded ? " in degraded mode" : ""}.
          </p>` : P`
            ${n.channel ? tt(n.channel) : I}
            ${e.via === "direct" || !r ? nt(n.host) : I}
          `}
      <p class="muted small">
        ${e.entities.length} entities
        (${e.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [Y, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .header h2 {
        flex: 1;
      }
      .snapshot img {
        display: block;
        width: 100%;
        max-width: 640px;
        border-radius: 8px;
        background: var(--secondary-background-color, #eee);
      }
      .snapshot.primary img {
        max-width: 100%;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
    `];
};
function tt(e) {
	let t = e.online ? e.sleeping ? "sleeping" : "online" : "offline";
	return P`<dl class="facts">
    <dt>Model</dt>
    <dd>${e.model}${e.model_id ? P` <span class="muted">(${e.model_id})</span>` : I}</dd>
    <dt>Hardware</dt>
    <dd>${e.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${e.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${t}</dd>
    <dt>Clear stream</dt>
    <dd>${De(e.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${De(e.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${rt(e.network)}</dd>
    ${e.battery ? P`<dt>Battery</dt>
          <dd>
            ${e.battery.percent ?? "?"}%${e.battery.status ? ` · ${e.battery.status}` : ""}${e.battery.temperature_c === null ? "" : ` · ${e.battery.temperature_c} °C`}
          </dd>` : I}
    <dt>Recordings</dt>
    <dd>${e.supports_replay ? "playback supported" : "no playback"}</dd>
    ${e.ai_types.length ? P`<dt>AI detection</dt>
          <dd>${e.ai_types.map((e) => $e[e] ?? e).join(", ")}</dd>` : I}
    ${e.capabilities.length ? P`<dt>Features</dt>
          <dd class="chips">${e.capabilities.map((e) => P`<span class="badge">${e}</span>`)}</dd>` : I}
  </dl>`;
}
function nt(e) {
	let t = e.ports;
	return P`<dl class="facts">
    ${e.device_type === "camera" ? I : P`<dt>Model</dt>
          <dd>${e.model ?? "?"}${e.model_id ? P` <span class="muted">(${e.model_id})</span>` : I}</dd>
          <dt>Hardware</dt>
          <dd>${e.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${e.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${e.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${rt(e.network)} · ${t.http.https ? "HTTPS" : "HTTP"}${t.http.port ? ` port ${t.http.port}` : ""}${e.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${J(t.rtsp.enabled)}${t.rtsp.port ? ` (${t.rtsp.port})` : ""} · RTMP
      ${J(t.rtmp.enabled)}${t.rtmp.port ? ` (${t.rtmp.port})` : ""} · ONVIF
      ${J(t.onvif.enabled)}${t.onvif.port ? ` (${t.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${e.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${e.storage.length ? e.storage.map((e, t) => P`${t ? P`<br />` : I}${e.type ?? "disk"} ${e.index + 1}:
              ${e.used_percent === null ? "?" : `${e.used_percent}% used`}${e.available === !1 ? " (not available)" : ""}`) : "none"}
    </dd>
    ${e.cpu_usage === null ? I : P`<dt>CPU</dt>
          <dd>${e.cpu_usage}%</dd>`}
    ${e.capabilities.length ? P`<dt>Host features</dt>
          <dd class="chips">${e.capabilities.map((e) => P`<span class="badge">${e}</span>`)}</dd>` : I}
  </dl>`;
}
function rt(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", et);
//#endregion
//#region src/components/device-page.ts
var it = 1e3, at = class extends W {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		tab: { attribute: !1 },
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
		super(), this.deviceId = "", this.tab = "overview";
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
		return e.size === 1 && e.has("hass") && this._renderedStates !== void 0 ? Ie(this._renderedStates, this.hass?.states, this._watched) : !0;
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
			let [e, r] = await Promise.all([Se(t, this.deviceId), Ce(t)]);
			if (n !== this._loadSeq) return;
			this._catalog = r, this._device = e, this._error = void 0, this._watched = ot(e);
		} catch (e) {
			if (n !== this._loadSeq) return;
			this._error = K(e).message;
		}
	}
	_subscribeRegistry(e) {
		this._unsubRegistry = e.connection.subscribeEvents((e) => {
			let t = e.data?.entity_id;
			(!t || this._device?.connections.some((e) => e.entities.some((e) => e.entity_id === t))) && (clearTimeout(this._reloadTimer), this._reloadTimer = setTimeout(() => void this.reload(), it));
		}, "entity_registry_updated").catch(() => void 0);
	}
	render() {
		this.renderCount += 1;
		let e = this._device, t = e?.node;
		return P`
      <div class="header">
        <button class="text back" @click=${() => {
			X(this, { view: "list" });
		}} aria-label="Back to all devices">← All devices</button>
      </div>
      ${this._error ? P`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : I}
      ${t ? P`<div class="title">
              <h2>${t.name ?? "Reolink device"}</h2>
              <span class="badge">${q(t.kind)}</span>
              ${t.kind === "camera" && t.connections.length > 1 ? P`<span class="badge" title="In Home Assistant via the NVR and directly"
                    >${t.connections.length} connections</span
                  >` : I}
              <span class="muted small">${t.model ?? ""}</span>
            </div>
            <div class="tabs" role="tablist">
              ${["overview", "settings"].map((e) => P`<button
                  role="tab"
                  aria-selected=${this.tab === e ? "true" : "false"}
                  class=${this.tab === e ? "active" : ""}
                  @click=${() => {
			X(this, {
				view: "device",
				id: this.deviceId,
				tab: e
			});
		}}
                >
                  ${e === "overview" ? "Overview" : "Settings"}
                </button>`)}
            </div>
            ${e.degraded ? P`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>` : I}
            ${this.tab === "overview" ? P`<rv-overview .hass=${this.hass} .device=${e}></rv-overview>` : P`<rv-settings
                  .hass=${this.hass}
                  .device=${e}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}` : this._error ? I : P`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [Y, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .back {
        padding-left: 0;
        color: var(--primary-color);
      }
      .title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
      .title h2 {
        margin: 0;
      }
      .tabs {
        display: flex;
        gap: 4px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }
      .tabs button {
        border: none;
        border-radius: 0;
        background: transparent;
        padding: 8px 16px;
        border-bottom: 2px solid transparent;
      }
      .tabs button.active {
        border-bottom-color: var(--primary-color);
        color: var(--primary-color);
      }
    `];
};
function ot(e) {
	let t = e.connections.flatMap((e) => e.entities.map((e) => e.entity_id));
	return e.node.kind === "camera" && e.node.snapshot_entity_id && t.push(e.node.snapshot_entity_id), t;
}
customElements.get("rv-device-page") || customElements.define("rv-device-page", at);
//#endregion
//#region src/download.ts
function st(e, t, n = document) {
	let r = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = n.createElement("a");
	a.href = i, a.download = t, a.rel = "noopener", n.body.appendChild(a), a.click(), a.remove(), setTimeout(() => {
		URL.revokeObjectURL(i);
	}, 1e3);
}
//#endregion
//#region src/reolink-viewer-panel.ts
var ct = 6e3, lt = class extends W {
	static properties = {
		hass: { attribute: !1 },
		narrow: { type: Boolean },
		_devices: { state: !0 },
		_loadError: { state: !0 },
		_probe: { state: !0 },
		_includeBattery: { state: !0 },
		_concurrency: { state: !0 },
		_maxStreams: { state: !0 },
		_copied: { state: !0 },
		_route: { state: !0 },
		_toast: { state: !0 }
	};
	_run;
	_loading = !1;
	_toastTimer;
	_onHashChange = () => {
		this._route = Ne(window.location.hash);
	};
	constructor() {
		super(), this.narrow = !1, this._probe = { status: "idle" }, this._includeBattery = !1, this._concurrency = !1, this._maxStreams = 4, this._copied = !1, this._route = { view: "list" }, this.addEventListener(Ae, (e) => {
			this.navigate(e.detail);
		}), this.addEventListener(je, (e) => {
			this.showToast(e.detail);
		});
	}
	connectedCallback() {
		super.connectedCallback(), this._route = Ne(window.location.hash), window.addEventListener("hashchange", this._onHashChange);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener("hashchange", this._onHashChange), clearTimeout(this._toastTimer), this._run?.cancel(), this._run = void 0;
	}
	updated(e) {
		e.has("hass") && this.hass && !this._devices && !this._loading && (this._load(), Ce(this.hass).catch(() => void 0));
	}
	navigate(e) {
		let t = Me(e);
		if (window.location.hash !== t) {
			let e = `${window.location.pathname}${window.location.search}${t}`;
			window.history.pushState(null, "", e);
		}
		e.view === "list" && this._route.view === "device" && this._load(), this._route = e;
	}
	showToast(e) {
		clearTimeout(this._toastTimer), this._toast = e, this._toastTimer = setTimeout(() => {
			this._toast = void 0;
		}, ct);
	}
	async _load() {
		if (this.hass) {
			this._loading = !0;
			try {
				this._devices = await xe(this.hass), this._loadError = void 0;
			} catch (e) {
				this._loadError = K(e).message;
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
		return P`
      <div class="toolbar">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">Reolink</div>
        ${e.view === "list" ? P`<button class="text" @click=${() => void this._load()} ?disabled=${this._loading}>
              Refresh
            </button>` : I}
      </div>
      <main>
        ${e.view === "device" ? P`<rv-device-page
              .hass=${this.hass}
              .deviceId=${e.id}
              .tab=${e.tab}
            ></rv-device-page>` : P`${this._renderBanner()}
              ${this._loadError ? I : P`<rv-device-list .devices=${this._devices}></rv-device-list>`}
              ${this._isAdmin ? this._renderProbe() : I}`}
      </main>
      ${this._toast ? P`<div class="toast ${this._toast.kind}" role="status" aria-live="polite">
            <span>${this._toast.message}</span>
            <button class="text" aria-label="Dismiss" @click=${() => {
			this._toast = void 0;
		}}>✕</button>
          </div>` : I}
    `;
	}
	_renderBanner() {
		if (this._loadError) return P`<div class="banner error" role="alert">
        Could not load devices: ${this._loadError}
      </div>`;
		let e = this._devices;
		return e?.degraded ? P`<div class="banner warning" role="alert">
      <strong>Degraded mode.</strong> The Reolink integration's internals changed in this
      Home Assistant release, so only the device registry's information is shown, duplicate
      cameras are not merged and the probe is disabled. Settings still work.
      <ul>
        ${e.compat.errors.map((e) => P`<li>${e}</li>`)}
      </ul>
    </div>` : I;
	}
	_renderProbe() {
		let e = this._probe.status === "running", t = e || !this._devices || this._devices.degraded;
		return P`<section class="card">
      <h2>Hardware probe</h2>
      <p class="muted">
        Measures which live and recorded-video methods work on each camera and how fast
        they start. It only reads: it never changes camera settings. The result is a JSON
        file with passwords, tokens, UIDs, serial numbers and addresses removed.
      </p>
      <label>
        <input
          type="checkbox"
          .checked=${this._includeBattery}
          ?disabled=${e}
          @change=${(e) => {
			this._includeBattery = e.target.checked;
		}}
        />
        Include battery cameras (wakes them and uses battery)
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${this._concurrency}
          ?disabled=${e}
          @change=${(e) => {
			this._concurrency = e.target.checked;
		}}
        />
        Test concurrent streams: opens up to
        <select
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
		].map((e) => P`<option value=${e} ?selected=${e === this._maxStreams}>${e}</option>`)}
        </select>
        sub streams at once on one camera per device, stopping at the first failure
      </label>
      <div class="actions">
        ${e ? P`<button @click=${() => {
			this._cancelProbe();
		}}>
              Cancel
            </button>` : P`<button class="primary" ?disabled=${t} @click=${() => {
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
			case "idle": return I;
			case "running": return P`<div class="progress" aria-live="polite">
          <p>Probing… this can take several minutes on an NVR.</p>
          <ol class="log">
            ${e.log.map((e) => P`<li>${e}</li>`)}
          </ol>
        </div>`;
			case "error": return P`<div class="banner error" role="alert">Probe failed: ${e.message}</div>`;
			case "done": return P`<div class="done">
          <p>
            Done. The report was saved as <code>${e.filename}</code>. If your browser or
            the Companion app blocked the download, use Copy JSON instead.
          </p>
          <div class="actions">
            <button @click=${() => {
				st(e.report, e.filename);
			}}>
              Download again
            </button>
            <button @click=${() => void this._copy(e.report)}>
              ${this._copied ? "Copied" : "Copy JSON"}
            </button>
          </div>
          <details>
            <summary>Show report</summary>
            <pre>${JSON.stringify(e.report, null, 2)}</pre>
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
		let t = Te(this.hass, {
			include_battery: this._includeBattery,
			concurrency_test: this._concurrency,
			max_streams: this._maxStreams
		}, (e) => {
			this._probe.status === "running" && (this._probe = {
				...this._probe,
				log: [...this._probe.log, e].slice(-8)
			});
		});
		this._run = t, t.result.then((e) => {
			if (this._run !== t) return;
			this._run = void 0;
			let n = ke(/* @__PURE__ */ new Date());
			this._probe = {
				status: "done",
				report: e,
				filename: n
			}, st(e, n);
		}, (e) => {
			this._run === t && (this._run = void 0, this._probe = {
				status: "error",
				message: K(e).message
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
	static styles = [Y, o`
      :host {
        display: block;
        min-height: 100%;
        background: var(--primary-background-color);
        color: var(--primary-text-color);
        font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        height: var(--header-height, 56px);
        padding: 0 12px;
        background: var(--app-header-background-color, var(--primary-color));
        color: var(--app-header-text-color, white);
        box-sizing: border-box;
      }
      .title {
        flex: 1;
        min-width: 0;
        font-size: 20px;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      main > * {
        min-width: 0;
      }
      label {
        display: block;
        margin: 8px 0;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      .log {
        font-family: var(--code-font-family, monospace);
        font-size: 13px;
        color: var(--secondary-text-color);
      }
      pre {
        max-height: 400px;
        overflow: auto;
        font-size: 12px;
        background: var(--secondary-background-color, #f5f5f5);
        padding: 8px;
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
        padding: 10px 16px;
        border-radius: 8px;
        background: var(--primary-text-color, #222);
        color: var(--primary-background-color, white);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      .toast.error {
        background: var(--error-color, #db4437);
        color: var(--text-primary-color, white);
      }
    `];
};
customElements.get("reolink-viewer-panel") || customElements.define("reolink-viewer-panel", lt);
//#endregion
export { lt as ReolinkViewerPanel };
