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
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: ee } = Object, m = globalThis, te = m.trustedTypes, ne = te ? te.emptyScript : "", re = m.reactiveElementPolyfillSupport, h = (e, t) => e, ie = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? ne : null;
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
}, ae = (e, t) => !l(e, t), oe = {
	attribute: !0,
	type: String,
	converter: ie,
	reflect: !1,
	useDefault: !1,
	hasChanged: ae
};
Symbol.metadata ??= Symbol("metadata"), m.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var g = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = oe) {
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
		return this.elementProperties.get(e) ?? oe;
	}
	static _$Ei() {
		if (this.hasOwnProperty(h("elementProperties"))) return;
		let e = ee(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(h("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(h("properties"))) {
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
			let i = (n.converter?.toAttribute === void 0 ? ie : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? ie : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? ae)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
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
g.elementStyles = [], g.shadowRootOptions = { mode: "open" }, g[h("elementProperties")] = /* @__PURE__ */ new Map(), g[h("finalized")] = /* @__PURE__ */ new Map(), re?.({ ReactiveElement: g }), (m.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var _ = globalThis, se = (e) => e, v = _.trustedTypes, ce = v ? v.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, le = "$lit$", y = `lit$${Math.random().toFixed(9).slice(2)}$`, ue = "?" + y, de = `<${ue}>`, b = document, x = () => b.createComment(""), S = (e) => e === null || typeof e != "object" && typeof e != "function", C = Array.isArray, fe = (e) => C(e) || typeof e?.[Symbol.iterator] == "function", w = "[ 	\n\f\r]", T = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, pe = /-->/g, me = />/g, E = RegExp(`>|${w}(?:([^\\s"'>=/]+)(${w}*=${w}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), he = /'/g, ge = /"/g, _e = /^(?:script|style|textarea|title)$/i, D = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), O = Symbol.for("lit-noChange"), k = Symbol.for("lit-nothing"), ve = /* @__PURE__ */ new WeakMap(), A = b.createTreeWalker(b, 129);
function ye(e, t) {
	if (!C(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return ce === void 0 ? t : ce.createHTML(t);
}
var be = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = T;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === T ? c[1] === "!--" ? o = pe : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = E) : (_e.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = E) : o = me : o === E ? c[0] === ">" ? (o = i ?? T, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? E : c[3] === "\"" ? ge : he) : o === ge || o === he ? o = E : o === pe || o === me ? o = T : (o = E, i = void 0);
		let d = o === E && e[t + 1].startsWith("/>") ? " " : "";
		a += o === T ? n + de : l >= 0 ? (r.push(s), n.slice(0, l) + le + n.slice(l) + y + d) : n + y + (l === -2 ? t : d);
	}
	return [ye(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, j = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = be(t, n);
		if (this.el = e.createElement(l, r), A.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = A.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(le)) {
					let t = u[o++], n = i.getAttribute(e).split(y), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? Se : r[1] === "?" ? Ce : r[1] === "@" ? we : P
					}), i.removeAttribute(e);
				} else e.startsWith(y) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (_e.test(i.tagName)) {
					let e = i.textContent.split(y), t = e.length - 1;
					if (t > 0) {
						i.textContent = v ? v.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], x()), A.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], x());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === ue) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(y, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += y.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = b.createElement("template");
		return n.innerHTML = e, n;
	}
};
function M(e, t, n = e, r) {
	if (t === O) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = S(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = M(e, i._$AS(e, t.values), i, r)), t;
}
var xe = class {
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? b).importNode(t, !0);
		A.currentNode = r;
		let i = A.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new N(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Te(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = A.nextNode(), a++);
		}
		return A.currentNode = b, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, N = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = k, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
		e = M(this, e, t), S(e) ? e === k || e == null || e === "" ? (this._$AH !== k && this._$AR(), this._$AH = k) : e !== this._$AH && e !== O && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? fe(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== k && S(this._$AH) ? this._$AA.nextSibling.data = e : this.T(b.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = j.createElement(ye(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new xe(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = ve.get(e.strings);
		return t === void 0 && ve.set(e.strings, t = new j(e)), t;
	}
	k(t) {
		C(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(x()), this.O(x()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = se(e).nextSibling;
			se(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, P = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = k, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = k;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = M(this, e, t, 0), a = !S(e) || e !== this._$AH && e !== O, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = M(this, r[n + o], t, o), s === O && (s = this._$AH[o]), a ||= !S(s) || s !== this._$AH[o], s === k ? e = k : e !== k && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === k ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, Se = class extends P {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === k ? void 0 : e;
	}
}, Ce = class extends P {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== k);
	}
}, we = class extends P {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = M(this, e, t, 0) ?? k) === O) return;
		let n = this._$AH, r = e === k && n !== k || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== k && (n === k || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Te = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		M(this, e);
	}
}, Ee = _.litHtmlPolyfillSupport;
Ee?.(j, N), (_.litHtmlVersions ??= []).push("3.3.3");
var De = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new N(t.insertBefore(x(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, F = globalThis, I = class extends g {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = De(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return O;
	}
};
I._$litElement$ = !0, I.finalized = !0, F.litElementHydrateSupport?.({ LitElement: I });
var Oe = F.litElementPolyfillSupport;
Oe?.({ LitElement: I }), (F.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region src/api.ts
var ke = (e) => e.callWS({ type: "reolink_viewer/devices" }), Ae = (e, t) => e.callWS({
	type: "reolink_viewer/device",
	device_id: t
}), je = /* @__PURE__ */ new WeakMap();
function Me(e) {
	let t = je.get(e.connection);
	return t || (t = e.callWS({ type: "reolink_viewer/catalog" }), je.set(e.connection, t), t.catch(() => je.delete(e.connection))), t;
}
var Ne = (e, t) => e.callWS({
	type: "config/entity_registry/update",
	entity_id: t,
	disabled_by: null
});
function Pe(e, t, n) {
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
				i = !0, c(L(e));
			});
		}),
		cancel: () => {
			i || (i = !0, o(), a(/* @__PURE__ */ Error("Probe cancelled")));
		}
	};
}
function L(e) {
	return e instanceof Error ? e : typeof e == "object" && e && "message" in e ? Error(String(e.message)) : Error(String(e));
}
var Fe = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/timeline/days",
	device_id: t,
	year: n,
	month: r
}), Ie = (e, t, n, r = 0) => e.callWS({
	type: "reolink_viewer/timeline/day",
	device_id: t,
	date: n,
	...r > 0 ? { max_age: r } : {}
}), Le = (e) => e.callWS({ type: "reolink_viewer/timeline/warm" }), Re = (e, t, n) => e.callWS({
	type: "reolink_viewer/playback/url",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	progressive: n
}), ze = (e, t) => e.callWS({
	type: "reolink_viewer/playback/prefetch",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream
}), Be = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/thumbnail/urls",
	device_id: t,
	times: n,
	bucket: r
}), Ve = (e, t) => e.callWS({
	type: "reolink_viewer/playback/media_info",
	device_id: t
}), He = {
	camera: "Camera",
	nvr: "NVR",
	hub: "Home Hub"
}, R = (e) => He[e];
function Ue(e) {
	let t = [];
	return e.codec && t.push(We(e.codec)), e.frame_rate && t.push(`${e.frame_rate} fps`), e.bit_rate && t.push(`${e.bit_rate} kbps`), t.length ? t.join(" · ") : "unknown";
}
function We(e) {
	switch (e.toLowerCase()) {
		case "h264": return "H.264";
		case "h265":
		case "hevc": return "H.265";
		default: return e;
	}
}
function z(e) {
	return e === null ? "unknown" : e ? "on" : "off";
}
function Ge(e) {
	return `reolink-viewer-probe-${e.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
}
//#endregion
//#region src/styles.ts
var B = o`
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
`, Ke = "rv-navigate", qe = "rv-toast";
function V(e, t) {
	e.dispatchEvent(new CustomEvent(Ke, {
		detail: t,
		bubbles: !0,
		composed: !0
	}));
}
function H(e, t, n = "info") {
	e.dispatchEvent(new CustomEvent(qe, {
		detail: {
			message: t,
			kind: n
		},
		bubbles: !0,
		composed: !0
	}));
}
function Je(e) {
	return e.view === "list" ? "" : `#device/${encodeURIComponent(e.id)}/${e.tab}`;
}
function Ye(e) {
	let t = /^#device\/([^/]+)(?:\/(overview|settings|playback))?$/.exec(e);
	if (!t?.[1]) return { view: "list" };
	let n = t[2];
	return {
		view: "device",
		id: decodeURIComponent(t[1]),
		tab: n === "settings" || n === "playback" ? n : "overview"
	};
}
//#endregion
//#region src/components/device-list.ts
var Xe = class extends I {
	static properties = { devices: { attribute: !1 } };
	render() {
		let e = this.devices;
		if (!e) return D`<p class="muted">Loading devices…</p>`;
		if (!e.hosts.length && !e.cameras.length) return D`<section class="card">
        <h2>No Reolink devices</h2>
        <p class="muted">
          Set up your cameras, NVRs or Home Hubs in the Reolink integration first; they appear
          here once loaded.
        </p>
      </section>`;
		let t = new Map(e.cameras.map((e) => [e.id, e])), n = e.cameras.filter((e) => e.host_id === null);
		return D`
      ${e.hosts.map((e) => this._renderHost(e, t))}
      ${n.length ? D`<section class="card">
            <h2>Cameras added directly</h2>
            <ul class="devices">
              ${n.map((e) => this._renderCamera(e))}
            </ul>
          </section>` : k}
    `;
	}
	_renderHost(e, t) {
		let n = e.camera_ids.map((e) => t.get(e)).filter((e) => e !== void 0);
		return D`<section class="card">
      <div class="host-header">
        <button class="link title" @click=${() => {
			V(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}>
          ${e.name ?? e.entry_title}
        </button>
        <span class="badge">${R(e.kind)}</span>
      </div>
      <p class="muted small">
        ${[e.model, e.sw_version && `firmware ${e.sw_version}`].filter(Boolean).join(" · ")}
      </p>
      ${n.length ? D`<ul class="devices">
            ${n.map((t) => this._renderCamera(t, e))}
          </ul>` : D`<p class="muted">No cameras on this ${R(e.kind)}.</p>`}
    </section>`;
	}
	_renderCamera(e, t) {
		let n = t ? e.connections.find((e) => e.host_id === t.id)?.channel : void 0, r = t !== void 0 && e.connections.some((e) => e.via === "direct");
		return D`<li>
      <button
        class="row"
        @click=${() => {
			V(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}
      >
        <span class="name">
          ${n == null ? k : D`<span class="muted">Ch ${n + 1}</span> `}${e.name ?? "Camera"}
        </span>
        <span class="muted small">${e.model ?? ""}</span>
        <span class="badges">
          ${Ze(e)}
          ${r ? D`<span class="badge" title="Also added to Home Assistant directly"
                >+ direct</span
              >` : k}
          ${e.primary_view === "snapshot" ? D`<span class="badge" title="Does not record: snapshots are its main view"
                >snapshots</span
              >` : k}
        </span>
      </button>
    </li>`;
	}
	static styles = [B, o`
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
function Ze(e) {
	let t = e.status;
	return t.online === !1 ? D`<span class="badge warning">offline</span>` : t.sleeping ? D`<span class="badge">sleeping</span>` : k;
}
customElements.get("rv-device-list") || customElements.define("rv-device-list", Xe);
//#endregion
//#region src/render-filter.ts
function Qe(e, t, n) {
	if (e === t) return !1;
	if (!e || !t) return !0;
	for (let r of n) if (e[r] !== t[r]) return !0;
	return !1;
}
//#endregion
//#region src/catalog.ts
var $e = {
	id: "other",
	title: "Other",
	description: "Entities this version of Reolink Viewer does not know yet."
};
function U(e, t, n) {
	if (e && n !== null) return e.entities[t]?.[n];
}
function et(e, t) {
	let n = t.indexOf(".");
	if (!(n < 0)) return U(e, t.slice(0, n), t.slice(n + 1));
}
function tt(e) {
	return [...e?.categories ?? [], $e];
}
function nt(e, t) {
	if (e?.impact !== "disruptive") return null;
	let n = e.disruptive_when ?? "any", r;
	return r = Array.isArray(n) ? typeof t == "object" && n.includes(t.option) : n === "any" || t === n, r ? e.impact_note ?? "This action can disrupt the camera." : null;
}
function rt(e, t) {
	return e.name ?? t?.title ?? e.entity_id;
}
var it = (e) => e.toLowerCase();
function at(e, t, n) {
	let r = it(n).split(/\s+/).filter(Boolean);
	if (!r.length) return !0;
	let i = it([
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
function ot(e, t) {
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
function st(e) {
	return {
		domain: "light",
		service: "turn_on",
		data: { brightness_pct: e }
	};
}
//#endregion
//#region src/writes.ts
var ct = 1e4, lt = class {
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
}, ut = 1, dt = class extends I {
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
	writes = new lt();
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
			let e = U(this.catalog, n.domain, n.key);
			if (!at(n, e, this._search)) continue;
			let r = t.get(n.category) ?? [];
			r.push({
				entity: n,
				entry: e,
				label: rt(n, e)
			}), t.set(n.category, r);
		}
		for (let e of t.values()) e.sort((e, t) => e.label.localeCompare(t.label));
		return t;
	}
	render() {
		let e = this.connection;
		if (!this.device || !e) return D`<p class="muted">No settings.</p>`;
		let t = this._rows(e), n = e.entities.filter((e) => e.disabled_by !== null).length, r = tt(this.catalog).filter((e) => t.has(e.id));
		return D`
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
      ${this._showDisabled ? D`<p class="banner info small">
            Home Assistant creates some Reolink entities disabled.
            ${this.hass?.user?.is_admin ? "Enabling one makes Home Assistant reload the Reolink integration entry for this device after about 30 seconds; its entities are briefly unavailable and the new one appears then." : "An administrator can enable them."}
          </p>` : k}
      ${r.length ? r.map((e) => D`<section class="category">
              <h3>${e.title}</h3>
              <p class="muted small">${e.description}</p>
              <ul class="rows">
                ${(t.get(e.id) ?? []).map((e) => this._renderRow(e))}
              </ul>
            </section>`) : D`<p class="muted">No settings match “${this._search}”.</p>`}
      ${this._renderConfirm()}
    `;
	}
	_renderConnections() {
		let e = this.device?.connections ?? [];
		if (e.length < 2) return k;
		let t = this.connection;
		return D`<div class="connections" role="radiogroup" aria-label="Settings via">
      <span class="small muted">Settings via</span>
      ${e.map((e, n) => D`<button
          role="radio"
          aria-checked=${e === t ? "true" : "false"}
          class=${e === t ? "primary" : ""}
          @click=${() => {
			this._connection = n;
		}}
        >
          ${ft(e)} (${e.entities.length})
        </button>`)}
      <span class="small muted">
        Both connections reach the same camera; a change made through either applies to it.
      </span>
    </div>`;
	}
	_renderRow(e) {
		let { entity: t, entry: n, label: r } = e, i = this._open.has(t.entity_id);
		return D`<li class="row" data-entity-id=${t.entity_id}>
      <div class="info">
        <div class="label">
          ${r}
          ${t.sub_device ? D`<span class="badge">${t.sub_device}</span>` : k}
          ${t.disabled_by === null ? k : D`<span class="badge">disabled</span>`}
          ${t.hidden_by === null ? k : D`<span class="badge">hidden</span>`}
          ${t.entity_category === "diagnostic" ? D`<span class="badge">diagnostic</span>` : k}
          ${n?.impact === "disruptive" ? D`<span class="badge warning" title=${n.impact_note ?? ""}>disruptive</span>` : k}
        </div>
        ${n ? D`<div class="muted small">${n.summary}</div>` : k}
      </div>
      <div class="control">${this._renderControl(t, r)}</div>
      ${n ? D`<details
            class="about"
            .open=${i}
            @toggle=${(e) => {
			this._setOpen(t.entity_id, e.target.open);
		}}
          >
            <summary class="small">About this setting</summary>
            ${i ? this._renderAbout(n) : k}
          </details>` : k}
    </li>`;
	}
	_setOpen(e, t) {
		if (this._open.has(e) === t) return;
		let n = new Set(this._open);
		t ? n.add(e) : n.delete(e), this._open = n;
	}
	_renderAbout(e) {
		let t = e.related.map((e) => et(this.catalog, e)?.title).filter((e) => e !== void 0);
		return D`<div class="about-body small">
      ${e.verification === "unverified" ? D`<p class="unverified">
            <span class="badge warning">unverified</span> Reolink does not document exactly what
            this does; the text says only what is known.
          </p>` : k}
      <p>${e.what_it_does}</p>
      ${e.tradeoffs ? D`<p><strong>Trade-offs:</strong> ${e.tradeoffs}</p>` : k}
      ${e.impact === "disruptive" ? D`<p><strong>Impact:</strong> ${e.impact_note}</p>` : k}
      <p><strong>Requires:</strong> ${e.requires}</p>
      ${e.notes ? D`<p>${e.notes}</p>` : k}
      ${t.length ? D`<p><strong>Related:</strong> ${t.join(", ")}</p>` : k}
      <p>
        <strong>Sources:</strong>
        ${e.sources.map((e, t) => D`${t ? ", " : ""}<a href=${e.url} target="_blank" rel="noreferrer"
              >${e.title}</a
            >`)}
      </p>
    </div>`;
	}
	_renderControl(e, t) {
		if (e.disabled_by !== null) {
			if (!this.hass?.user?.is_admin) return D`<span class="muted small">Disabled</span>`;
			let n = this._enabling.has(e.entity_id);
			return D`<button ?disabled=${n} @click=${() => void this._enable(e, t)}>
        ${n ? "Enabling…" : "Enable"}
      </button>`;
		}
		let n = this.hass?.states[e.entity_id];
		if (!n) return D`<span class="muted small">Not loaded yet</span>`;
		let r = e.entity_id, i = this.writes.isPending(r), a = this.writes.valueFor(r), o = n.state === "unavailable" || i;
		switch (e.domain) {
			case "switch":
			case "siren": return this._toggle(e, t, a ?? n.state === "on", o && !i);
			case "light": return this._light(e, t, n, a, o && !i);
			case "number": return this._number(e, t, n, a, o);
			case "select": return this._select(e, t, n, a, o);
			case "time": return D`<input
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
			case "button": return D`<button
          ?disabled=${o}
          @click=${() => void this._write(e, t, "press", "any")}
        >
          ${i ? "Pressing…" : "Press"}
        </button>`;
			case "update": return this._update(e, t, n, i);
			default: return D`<span class="value">${pt(n, e.domain)}</span>`;
		}
	}
	_toggle(e, t, n, r) {
		let i = n === !0;
		return D`<button
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
		return D`<span class="light">
      ${o && l ? D`<input
            type="range"
            min="1"
            max="100"
            aria-label="${t} brightness"
            .value=${String(typeof r == "number" ? r : c)}
            ?disabled=${i}
            @change=${(n) => {
			let r = Number(n.target.value);
			this._write(e, t, r, "on", st(r));
		}}
          />` : k}
      ${this._toggle(e, t, l, i)}
    </span>`;
	}
	_number(e, t, n, r, i) {
		let a = n.attributes, o = W(a.min, 0), s = W(a.max, 100), c = W(a.step, 1), l = typeof a.unit_of_measurement == "string" ? a.unit_of_measurement : "", u = Number(n.state), d = typeof r == "number" ? r : u, f = Number.isFinite(d) ? String(d) : "", p = (n) => {
			let r = n.target, i = Number(r.value);
			r.value === "" || !Number.isFinite(i) || i < o || i > s ? r.value = f : i !== d && this._write(e, t, i, "any");
		};
		return D`<span class="number">
      ${a.mode === "box" ? k : D`<input
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
      ${l ? D`<span class="unit muted small">${l}</span>` : k}
    </span>`;
	}
	_select(e, t, n, r, i) {
		let a = Array.isArray(n.attributes.options) ? n.attributes.options.map(String) : [], o = typeof r == "string" ? r : n.state;
		return D`<select
      aria-label=${t}
      ?disabled=${i}
      @change=${(n) => {
			let r = n.target, i = r.value;
			r.value = o, this._write(e, t, i, { option: i });
		}}
    >
      ${a.includes(o) ? k : D`<option value="" selected>—</option>`}
      ${a.map((e) => D`<option value=${e} ?selected=${e === o}>${e}</option>`)}
    </select>`;
	}
	_update(e, t, n, r) {
		let i = n.attributes, a = typeof i.installed_version == "string" ? i.installed_version : "?", o = typeof i.latest_version == "string" ? i.latest_version : null, s = typeof i.supported_features == "number" ? i.supported_features : 0, c = i.in_progress === !0 || r, l = n.state === "on" && (s & ut) !== 0;
		return D`<span class="update small">
      <span>
        ${a}${o && o !== a ? D` → <strong>${o}</strong>` : k}
        ${n.state === "off" ? D`<span class="muted">(up to date)</span>` : k}
      </span>
      ${l || c ? D`<button
            ?disabled=${c}
            @click=${() => void this._write(e, t, "install", "any")}
          >
            ${c ? "Installing…" : "Install"}
          </button>` : k}
    </span>`;
	}
	async _write(e, t, n, r, i) {
		let a = this.hass;
		if (!a) return;
		let o = nt(U(this.catalog, e.domain, e.key), r);
		if (o !== null && !await this.confirm(t, o)) return;
		let s = i ?? ot(e.domain, e.domain === "button" ? "press" : e.domain === "update" ? "install" : n), c = e.entity_id, l = this.writes.begin(c, n, a.states[c]);
		this.requestUpdate();
		try {
			await a.callService(s.domain, s.service, s.data, { entity_id: c }, !1), this.writes.confirm(c, l), this._scheduleSettle();
		} catch (e) {
			this.writes.fail(c, l) && H(this, `Could not change ${t}: ${L(e).message}`, "error");
		}
		this.requestUpdate();
	}
	_scheduleSettle() {
		clearTimeout(this._settleTimer), this._settleTimer = setTimeout(() => {
			this.hass && this.writes.settle(this.hass.states) && this.requestUpdate(), this.writes.size && this._scheduleSettle();
		}, ct + 100);
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
		return e ? D`<div class="scrim" @click=${() => {
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
    </div>` : k;
	}
	async _enable(e, t) {
		let n = this.hass;
		if (n) {
			this._enabling = /* @__PURE__ */ new Set([...this._enabling, e.entity_id]);
			try {
				let r = (await Ne(n, e.entity_id)).reload_delay;
				H(this, `${t} enabled. Home Assistant reloads the Reolink entry${r ? ` in about ${r} seconds` : ""}; the entity becomes available after that.`), this.dispatchEvent(new CustomEvent("rv-entity-enabled", {
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				H(this, `Could not enable ${t}: ${L(e).message}`, "error");
			} finally {
				let t = new Set(this._enabling);
				t.delete(e.entity_id), this._enabling = t;
			}
		}
	}
	static styles = [B, o`
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
function ft(e) {
	return e.via === "nvr" ? `NVR (${e.host_name ?? e.entry_title})` : "Direct";
}
function W(e, t) {
	return typeof e == "number" && Number.isFinite(e) ? e : t;
}
function pt(e, t) {
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
customElements.get("rv-settings") || customElements.define("rv-settings", dt);
//#endregion
//#region src/components/overview.ts
var mt = 3e4, ht = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, gt = class extends I {
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
		}, mt));
	}
	snapshotUrl() {
		let e = this.device?.node;
		if (e?.kind !== "camera" || !e.snapshot_entity_id) return null;
		let t = this.hass?.states[e.snapshot_entity_id]?.attributes.entity_picture;
		return typeof t != "string" || !t ? null : this._stamp ? `${t}${t.includes("?") ? "&" : "?"}_=${this._stamp}` : t;
	}
	render() {
		let e = this.device;
		if (!e) return D``;
		let t = e.node;
		return D`
      ${t.kind === "camera" ? this._renderSnapshot(t) : this._renderCameras()}
      ${e.connections.map((t) => this._renderConnection(t, e))}
    `;
	}
	_renderSnapshot(e) {
		let t = this.snapshotUrl(), n = e.primary_view === "snapshot";
		return D`<section class="card snapshot ${n ? "primary" : ""}">
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
      ${n ? D`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${mt / 1e3} seconds while this page is open.
          </p>` : k}
      ${t ? D`<img src=${t} alt="Latest snapshot of ${e.name ?? "the camera"}" />` : D`<p class="muted">
            No snapshot: enable one of this camera's stream entities (for example
            <em>Fluent</em>) in the Settings tab.
          </p>`}
    </section>`;
	}
	_renderCameras() {
		let e = this.device?.node;
		return e?.kind === "camera" ? k : D`<section class="card">
      <h2>${R(e?.kind ?? "nvr")}</h2>
      <p class="muted small">${e?.camera_ids.length ?? 0} cameras; open one from the list.</p>
      <button class="link" @click=${() => {
			V(this, { view: "list" });
		}}>All devices</button>
    </section>`;
	}
	_renderConnection(e, t) {
		let n = e.details, r = t.node.kind === "camera";
		return D`<section class="card">
      <div class="header">
        <h2>${r ? ft(e) : "Device"}</h2>
        ${e.playback_source ? D`<span class="badge accent">playback source</span>` : k}
        ${e.channel !== void 0 && e.channel !== null && e.via === "nvr" ? D`<span class="badge">channel ${e.channel + 1}</span>` : k}
      </div>
      ${n === null ? D`<p class="muted">
            Details are unavailable${t.degraded ? " in degraded mode" : ""}.
          </p>` : D`
            ${n.channel ? _t(n.channel) : k}
            ${e.via === "direct" || !r ? vt(n.host) : k}
          `}
      <p class="muted small">
        ${e.entities.length} entities
        (${e.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [B, o`
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
function _t(e) {
	let t = e.online ? e.sleeping ? "sleeping" : "online" : "offline";
	return D`<dl class="facts">
    <dt>Model</dt>
    <dd>${e.model}${e.model_id ? D` <span class="muted">(${e.model_id})</span>` : k}</dd>
    <dt>Hardware</dt>
    <dd>${e.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${e.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${t}</dd>
    <dt>Clear stream</dt>
    <dd>${Ue(e.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${Ue(e.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${yt(e.network)}</dd>
    ${e.battery ? D`<dt>Battery</dt>
          <dd>
            ${e.battery.percent ?? "?"}%${e.battery.status ? ` · ${e.battery.status}` : ""}${e.battery.temperature_c === null ? "" : ` · ${e.battery.temperature_c} °C`}
          </dd>` : k}
    <dt>Recordings</dt>
    <dd>${e.supports_replay ? "playback supported" : "no playback"}</dd>
    ${e.ai_types.length ? D`<dt>AI detection</dt>
          <dd>${e.ai_types.map((e) => ht[e] ?? e).join(", ")}</dd>` : k}
    ${e.capabilities.length ? D`<dt>Features</dt>
          <dd class="chips">${e.capabilities.map((e) => D`<span class="badge">${e}</span>`)}</dd>` : k}
  </dl>`;
}
function vt(e) {
	let t = e.ports;
	return D`<dl class="facts">
    ${e.device_type === "camera" ? k : D`<dt>Model</dt>
          <dd>${e.model ?? "?"}${e.model_id ? D` <span class="muted">(${e.model_id})</span>` : k}</dd>
          <dt>Hardware</dt>
          <dd>${e.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${e.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${e.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${yt(e.network)} · ${t.http.https ? "HTTPS" : "HTTP"}${t.http.port ? ` port ${t.http.port}` : ""}${e.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${z(t.rtsp.enabled)}${t.rtsp.port ? ` (${t.rtsp.port})` : ""} · RTMP
      ${z(t.rtmp.enabled)}${t.rtmp.port ? ` (${t.rtmp.port})` : ""} · ONVIF
      ${z(t.onvif.enabled)}${t.onvif.port ? ` (${t.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${e.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${e.storage.length ? e.storage.map((e, t) => D`${t ? D`<br />` : k}${e.type ?? "disk"} ${e.index + 1}:
              ${e.used_percent === null ? "?" : `${e.used_percent}% used`}${e.available === !1 ? " (not available)" : ""}`) : "none"}
    </dd>
    ${e.cpu_usage === null ? k : D`<dt>CPU</dt>
          <dd>${e.cpu_usage}%</dd>`}
    ${e.capabilities.length ? D`<dt>Host features</dt>
          <dd class="chips">${e.capabilities.map((e) => D`<span class="badge">${e}</span>`)}</dd>` : k}
  </dl>`;
}
function yt(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", gt);
//#endregion
//#region src/playback/codec.ts
function bt() {
	let e = navigator.mediaCapabilities, t = e?.decodingInfo;
	return t ? t.bind(e) : void 0;
}
async function xt(e, t = bt()) {
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
function St(e = navigator.userAgent) {
	return !(/AppleWebKit/.test(e) && !/Chrome|Chromium|CriOS|Edg|Android|FxiOS/.test(e));
}
//#endregion
//#region src/playback/timeline-math.ts
var G = 6e4, K = 60 * G, Ct = 24 * K, q = [
	Ct,
	6 * K,
	K,
	15 * G,
	5 * G
];
function wt(e, t, n) {
	return (e - t.start) / t.span * n;
}
function Tt(e, t, n) {
	return t.start + e / n * t.span;
}
function J(e, t) {
	let n = t.end - t.start, r = q[q.length - 1] ?? 6e4, i = Math.min(Math.max(e.span, r), Math.max(n, r));
	return i >= n ? {
		start: t.start,
		span: n
	} : {
		start: Math.min(Math.max(e.start, t.start), t.end - i),
		span: i
	};
}
function Et(e, t, n, r) {
	return J({
		start: n - (n - e.start) / e.span * t,
		span: t
	}, r);
}
function Dt(e) {
	let t = 0;
	return q.forEach((n, r) => {
		Math.abs(n - e) < Math.abs((q[t] ?? n) - e) && (t = r);
	}), t;
}
function Ot(e, t, n) {
	return J({
		start: t - e.span / 2,
		span: e.span
	}, n);
}
var kt = [
	1e4,
	3e4,
	G,
	5 * G,
	10 * G,
	15 * G,
	30 * G,
	K,
	2 * K,
	3 * K,
	6 * K
];
function At(e, t, n = 60) {
	for (let r of kt) if (r / e.span * t >= n) return r;
	return kt[kt.length - 1] ?? 36e5;
}
function jt(e, t, n) {
	let r = At(e, t), i = [], a = e.start + e.span, o = n(e.start), s = Math.ceil((e.start + o) / r) * r - o;
	for (let e = 0; s <= a && e < 500; e += 1) i.push(s), s += r;
	return i;
}
function Mt(e, t, n, r = 1) {
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
function Nt(e, t) {
	let n = 0, r = e.length - 1, i;
	for (; n <= r;) {
		let a = n + r >> 1, o = e.at(a);
		if (!o) break;
		o.start <= t ? (t < o.end && (i = o), n = a + 1) : r = a - 1;
	}
	return i;
}
function Pt(e, t) {
	return e.find((e) => e.start > t);
}
function Ft(e, t) {
	let n = Nt(e, t);
	if (n) return {
		segment: n,
		offset: t - n.start
	};
	let r = Pt(e, t);
	return r ? {
		segment: r,
		offset: 0
	} : void 0;
}
function It(e, t) {
	return t.size === 0 ? e : e.filter((e) => e.types.some((e) => !t.has(e)));
}
function Lt(e, t) {
	return e.find((e) => e.start > t + 500);
}
function Rt(e, t) {
	let n;
	for (let r of e) if (r.start < t - 1500) n = r;
	else break;
	return n;
}
var zt = [
	{
		type: "PERSON",
		label: "Person",
		color: "#e53935"
	},
	{
		type: "VEHICLE",
		label: "Vehicle",
		color: "#1e88e5"
	},
	{
		type: "ANIMAL",
		label: "Animal",
		color: "#43a047"
	},
	{
		type: "CROSSLINE",
		label: "Line crossing",
		color: "#8e24aa"
	},
	{
		type: "INTRUSION",
		label: "Intrusion",
		color: "#d81b60"
	},
	{
		type: "LINGER",
		label: "Loitering",
		color: "#6d4c41"
	},
	{
		type: "FACE",
		label: "Face",
		color: "#f4511e"
	},
	{
		type: "DOORBELL",
		label: "Doorbell",
		color: "#fdd835"
	},
	{
		type: "PACKAGE",
		label: "Package",
		color: "#00897b"
	},
	{
		type: "FORGOTTEN_ITEM",
		label: "Item left",
		color: "#5e35b1"
	},
	{
		type: "TAKEN_ITEM",
		label: "Item taken",
		color: "#3949ab"
	},
	{
		type: "CRYING",
		label: "Crying",
		color: "#c0ca33"
	},
	{
		type: "IO",
		label: "Alarm input",
		color: "#757575"
	},
	{
		type: "MOTION",
		label: "Motion",
		color: "#fb8c00"
	},
	{
		type: "TIMER",
		label: "Scheduled",
		color: "#90a4ae"
	}
], Y = new Map(zt.map((e, t) => [e.type, t]));
function Bt(e) {
	let t;
	for (let n of e) (t === void 0 || (Y.get(n) ?? 99) < (Y.get(t) ?? 99)) && (t = n);
	return t ?? "MOTION";
}
function X(e) {
	return zt[Y.get(e) ?? -1]?.color ?? "#9e9e9e";
}
function Vt(e) {
	return zt[Y.get(e) ?? -1]?.label ?? e.toLowerCase();
}
function Ht(e) {
	return [...new Set(e.flatMap((e) => e.types))].sort((e, t) => (Y.get(e) ?? 99) - (Y.get(t) ?? 99));
}
function Ut(e) {
	return e >= 216e5 ? 300 : e >= 36e5 ? 60 : e >= 9e5 ? 10 : 5;
}
function Wt(e, t, n) {
	let r = new Date(Date.UTC(e, t - 1, 1)).getUTCDay(), i = new Date(Date.UTC(e, t, 0)).getUTCDate(), a = (r - n % 7 + 7) % 7, o = [...Array.from({ length: a }, () => null), ...Array.from({ length: i }, (e, t) => t + 1)];
	for (; o.length % 7;) o.push(null);
	let s = [];
	for (let e = 0; e < o.length; e += 7) s.push(o.slice(e, e + 7));
	return s;
}
function Gt(e, t, n) {
	let r = e * 12 + (t - 1) + n;
	return [Math.floor(r / 12), r % 12 + 1];
}
function Kt(e, t, n) {
	return `${String(e).padStart(4, "0")}-${String(t).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
//#endregion
//#region src/playback/calendar.ts
var qt = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], Jt = class extends I {
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
		let [t, n] = Gt(this.year, this.month, e);
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
		}), t = qt.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "narrow",
			timeZone: "UTC"
		})), [n, r] = Gt(this.year, this.month, 1), i = this.today !== void 0 && Kt(n, r, 1) > this.today;
		return D`<div class="head">
        <button class="text" aria-label="Previous month" @click=${() => {
			this._move(-1);
		}}>‹</button>
        <span class="title">${e}${this.loading ? D` <span class="muted small">…</span>` : k}</span>
        <button class="text" aria-label="Next month" ?disabled=${i} @click=${() => {
			this._move(1);
		}}>›</button>
      </div>
      <div class="grid" role="grid">
        ${t.map((e) => D`<span class="dow" role="columnheader">${e}</span>`)}
        ${Wt(this.year, this.month, this.firstDay).flat().map((e) => {
			if (e === null) return D`<span></span>`;
			let t = Kt(this.year, this.month, e), n = this.today !== void 0 && t > this.today, r = this.days.has(e);
			return D`<button
              role="gridcell"
              class="day ${t === this.selected ? "selected" : ""} ${t === this.today ? "today" : ""}"
              ?disabled=${n}
              aria-pressed=${t === this.selected ? "true" : "false"}
              aria-label="${t}${r ? ", has recordings" : ""}"
              @click=${() => {
				this._emit("rv-day", { date: t });
			}}
            >
              ${e}${r ? D`<span class="dot"></span>` : k}
            </button>`;
		})}
      </div>`;
	}
	static styles = [B, o`
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
        border-radius: 6px;
        background: transparent;
      }
      .day.today {
        font-weight: 700;
      }
      .day.selected {
        background: var(--primary-color);
        color: var(--text-primary-color, white);
      }
      .dot {
        position: absolute;
        left: 50%;
        bottom: 3px;
        width: 5px;
        height: 5px;
        margin-left: -2.5px;
        border-radius: 50%;
        background: var(--primary-color);
      }
      .day.selected .dot {
        background: var(--text-primary-color, white);
      }
    `];
};
customElements.get("rv-calendar") || customElements.define("rv-calendar", Jt);
//#endregion
//#region src/playback/time.ts
var Yt = /* @__PURE__ */ new Map();
function Z(e, t) {
	let n = `${e ?? ""}|${JSON.stringify(t)}`, r = Yt.get(n);
	if (!r) {
		try {
			r = new Intl.DateTimeFormat(void 0, {
				...t,
				...e ? { timeZone: e } : {}
			});
		} catch {
			r = new Intl.DateTimeFormat(void 0, t);
		}
		Yt.set(n, r);
	}
	return r;
}
function Q(e, t, n = !1) {
	return Z(t, {
		hour: "2-digit",
		minute: "2-digit",
		...n ? { second: "2-digit" } : {},
		hourCycle: "h23"
	}).format(e);
}
function Xt(e, t) {
	return Z(t, {
		weekday: "short",
		month: "short",
		day: "numeric"
	}).format(e);
}
function Zt(e) {
	let t = Math.max(0, Math.round(e / 1e3)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = t % 60;
	return n ? `${n} h ${String(r).padStart(2, "0")} min` : r ? `${r} min ${String(i).padStart(2, "0")} s` : `${i} s`;
}
function Qt(e, t) {
	let n = Z(t, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).formatToParts(e), r = (e) => n.find((t) => t.type === e)?.value ?? "";
	return `${r("year")}-${r("month")}-${r("day")}`;
}
function $t(e, t) {
	let n = Z(t, {
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
function en(e) {
	try {
		let t = new Intl.Locale(e ?? navigator.language), n = t.getWeekInfo?.() ?? t.weekInfo;
		if (n) return n.firstDay % 7;
	} catch {}
	return +!/^en-(US|CA)|^ja|^he/.test(e ?? navigator.language);
}
var tn = class extends I {
	static properties = {
		events: { attribute: !1 },
		thumbs: { attribute: !1 },
		current: { attribute: !1 },
		timeZone: { attribute: !1 },
		_shown: { state: !0 }
	};
	constructor() {
		super(), this.events = [], this.thumbs = /* @__PURE__ */ new Map(), this._shown = 60;
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
	_card(e) {
		let t = Bt(e.types), n = this.thumbs.get(e.start);
		return D`<li>
      <button
        class="card ${this.current !== void 0 && this.current >= e.start && this.current < e.end ? "active" : ""}"
        aria-label="${e.types.map(Vt).join(", ")} at ${Q(e.start, this.timeZone, !0)}"
        @click=${() => {
			this.dispatchEvent(new CustomEvent("rv-pick", {
				detail: { event: e },
				bubbles: !0,
				composed: !0
			}));
		}}
      >
        <span class="thumb" style="border-color: ${X(t)}">
          ${n ? D`<img src=${n} alt="" loading="lazy" decoding="async" />` : k}
        </span>
        <span class="meta">
          <span class="types">
            ${e.types.map((e) => D`<span class="badge" style="background: ${X(e)}; color: white">${Vt(e)}</span>`)}
          </span>
          <span class="when">
            ${Q(e.start, this.timeZone, !0)}
            <span class="muted">· ${Zt(e.end - e.start)}</span>
            ${e.ambiguous ? D`<span class="muted" title="Recorded in the hour repeated when clocks went back"> · time ±1 h</span>` : k}
          </span>
        </span>
      </button>
    </li>`;
	}
	render() {
		if (!this.events.length) return D`<p class="muted">No events for the selected filters.</p>`;
		let e = this.events.length - this._shown;
		return D`<ul>
        ${this.visible.map((e) => this._card(e))}
      </ul>
      ${e > 0 ? D`<button class="more" @click=${() => {
			this._shown += 60;
		}}>Show ${Math.min(e, 60)} more (${e} left)</button>` : k}`;
	}
	static styles = [B, o`
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
      }
      .card {
        display: flex;
        gap: 8px;
        width: 100%;
        padding: 6px;
        text-align: left;
        align-items: center;
      }
      .card.active {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 1px var(--primary-color);
      }
      .thumb {
        flex: none;
        width: 96px;
        height: 54px;
        border-radius: 4px;
        border-left: 4px solid;
        background: var(--secondary-background-color, #eee);
        overflow: hidden;
      }
      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .types {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .when {
        font-size: 13px;
      }
      .more {
        margin-top: 8px;
      }
    `];
};
customElements.get("rv-event-list") || customElements.define("rv-event-list", tn);
//#endregion
//#region src/playback/player.ts
var nn = class extends I {
	static properties = {
		muted: { type: Boolean },
		_active: { state: !0 },
		_paused: { state: !0 }
	};
	_items = [void 0, void 0];
	_requestedAt;
	_endedAt;
	_pendingOffset = [0, 0];
	constructor() {
		super(), this.muted = !0, this._active = 0, this._paused = !0;
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
		await this.updateComplete, this._requestedAt = n, this._endedAt = void 0, this.preloaded?.url === e.url && (this._active = this._other);
		let r = this._active, i = this._video(r);
		i && (this._items[r] = e, this._pendingOffset[r] = t, i.getAttribute("src") === e.url ? this._seekTo(i, t) : (i.setAttribute("src", e.url), i.load()), this._start(i), this.requestUpdate());
	}
	async preload(e) {
		await this.updateComplete;
		let t = this._other, n = this._video(t);
		n && this._items[t]?.url !== e?.url && (this._items[t] = e, this._pendingOffset[t] = 0, n.pause(), e ? (n.setAttribute("src", e.url), n.preload = "auto", n.load()) : n.removeAttribute("src"));
	}
	seek(e) {
		let t = this._video(this._active);
		t && this._seekTo(t, e);
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
			t?.pause(), t?.removeAttribute("src"), this._items[e] = void 0;
		}
		this._paused = !0;
	}
	_seekTo(e, t) {
		let n = Math.max(0, t / 1e3);
		e.readyState >= 1 ? e.currentTime = n : this._pendingOffset[Number(e.dataset.slot)] = t;
	}
	_start(e) {
		e.play()?.catch((e) => {
			e instanceof DOMException && e.name === "NotAllowedError" ? this._paused = !0 : e instanceof DOMException && e.name === "AbortError" || this._fail(String(e));
		});
	}
	_fail(e) {
		this.dispatchEvent(new CustomEvent("rv-player-error", {
			detail: {
				message: e,
				segmentId: this.current?.segmentId
			},
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
		this._paused = !1;
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
	_onEnded(e) {
		if (e !== this._active) return;
		let t = this.current;
		if (this._endedAt = performance.now(), this.preloaded) {
			this._items[e] = void 0, this._active = this._other;
			let t = this._video(this._active);
			t && this._start(t);
		} else this._endedAt = void 0, this._paused = !0, this._emit("rv-ended", { segmentId: t?.segmentId });
	}
	_onTime(e) {
		if (e !== this._active) return;
		let t = this.time;
		t !== void 0 && this._emit("rv-time", { time: t });
	}
	_onError(e, t) {
		let n = t.target;
		n.getAttribute("src") && (e === this._active ? this._fail(n.error?.message || `media error ${n.error?.code ?? "?"}`) : this._items[e] = void 0);
	}
	_renderVideo(e) {
		return D`<video
      data-slot=${e}
      class=${e === this._active ? "active" : "hidden"}
      playsinline
      .muted=${this.muted}
      ?controls=${e === this._active}
      preload="auto"
      @loadedmetadata=${(t) => {
			this._onMetadata(e, t);
		}}
      @playing=${() => {
			this._onPlaying(e);
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
		return D`<div class="frame">${this._renderVideo(0)}${this._renderVideo(1)}</div>`;
	}
	static styles = o`
    :host {
      display: block;
    }
    .frame {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
    }
    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    /* The hidden buffer stays laid out (some browsers do not load hidden video). */
    video.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
};
customElements.get("rv-player") || customElements.define("rv-player", nn);
//#endregion
//#region src/playback/thumb-loader.ts
var rn = class {
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
}, an = 4, $ = 76, on = 18, sn = 22, cn = 26, ln = 52, un = 16, dn = class extends I {
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
			span: q[0] ?? 864e5
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
		return Tt(e, this.view, this._width || 1);
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
		let t = J(e, this._bounds);
		(t.start !== this.view.start || t.span !== this.view.span) && this._emit("rv-view-change", { view: t });
	}
	zoom(e, t) {
		let n = q[Math.min(Math.max(Dt(this.view.span) + e, 0), q.length - 1)] ?? this.view.span, r = t ?? this.cursor ?? this.view.start + this.view.span / 2;
		this._setView(Et(this.view, n, r, this._bounds));
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
		}, fn(this._canvas, e.pointerId, !0));
	}
	_onPointerMove(e) {
		let t = this._x(e), n = this._drag;
		if (n && n.pointerId === e.pointerId) {
			if (Math.abs(t - n.x) > an && (n.moved = !0), n.moved) {
				let e = this.timeAt(t);
				this._emit("rv-scrub", { time: e }), this._scheduleHover(e, t);
			}
		} else e.pointerType === "mouse" && this._scheduleHover(this.timeAt(t), t);
	}
	_onPointerUp(e) {
		let t = this._drag;
		t && t.pointerId === e.pointerId && (this._drag = void 0, fn(this._canvas, e.pointerId, !1), this._emit("rv-seek", { time: this.timeAt(this._x(e)) }), e.pointerType !== "mouse" && this._endHover());
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
		e.width !== t * n && (e.width = t * n, e.height = $ * n);
		let r = e.getContext("2d");
		if (!r) return;
		r.setTransform(n, 0, 0, n, 0, 0);
		let i = getComputedStyle(this), a = (e, t) => i.getPropertyValue(e).trim() || t, o = a("--secondary-text-color", "#727272"), s = a("--divider-color", "#e0e0e0"), c = a("--rv-recording-color", a("--primary-color", "#03a9f4"));
		r.clearRect(0, 0, t, $);
		let l = this.view, u = (e) => wt(e, l, t);
		r.font = "11px sans-serif", r.textBaseline = "top", r.fillStyle = o, r.strokeStyle = s, r.lineWidth = 1;
		let d = this.timeZone, f = At(l, t) < G;
		for (let e of jt(l, t, (e) => $t(e, d))) {
			let n = Math.round(u(e)) + .5;
			r.beginPath(), r.moveTo(n, 14), r.lineTo(n, $), r.stroke();
			let i = Q(e, d, f);
			n + 3 + r.measureText(i).width <= t && r.fillText(i, n + 3, 2);
		}
		let p = this.day;
		if (p) {
			if (p.now < p.end) {
				r.fillStyle = a("--secondary-background-color", "#f2f2f2");
				let e = Math.max(0, u(p.now));
				r.fillRect(e, sn, t - e, 54);
			}
			r.globalAlpha = .85, r.fillStyle = c;
			for (let e of Mt(p.segments, l, t)) {
				let n = Math.max(0, u(e.start)), i = Math.min(t, u(e.end));
				r.fillRect(n, sn, Math.max(1, i - n), cn);
			}
			r.globalAlpha = 1;
			for (let e of this.events) {
				if (e.end < l.start || e.start > l.start + l.span) continue;
				let t = u(e.start), n = Math.max(3, u(e.end) - t);
				r.fillStyle = X(Bt(e.types)), r.fillRect(t, ln, n, un);
			}
		}
		if (this.cursor !== void 0) {
			let e = Math.round(u(this.cursor)) + .5;
			r.strokeStyle = a("--accent-color", "#ff9800"), r.lineWidth = 2, r.beginPath(), r.moveTo(e, on), r.lineTo(e, $), r.stroke();
		}
	}
	render() {
		return D`<canvas
      role="slider"
      tabindex="0"
      aria-label="Recording timeline"
      aria-valuemin=${this.day?.start ?? 0}
      aria-valuemax=${this.day?.end ?? 0}
      aria-valuenow=${this.cursor ?? 0}
      aria-valuetext=${this.cursor === void 0 ? "no position" : Q(this.cursor, this.timeZone, !0)}
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
      height: ${$}px;
      touch-action: pan-y;
      cursor: pointer;
      border-radius: 6px;
    }
    canvas:focus-visible {
      outline: 2px solid var(--primary-color);
    }
  `;
};
function fn(e, t, n) {
	try {
		n ? e?.setPointerCapture(t) : e?.releasePointerCapture(t);
	} catch {}
}
customElements.get("rv-timeline") || customElements.define("rv-timeline", dn);
//#endregion
//#region src/components/playback.ts
var pn = 6e4, mn = 10 * G, hn = 10, gn = 8e3, _n = class extends I {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		cameraName: { attribute: !1 },
		_date: { state: !0 },
		_day: { state: !0 },
		_error: { state: !0 },
		_playFailure: { state: !0 },
		_loading: { state: !0 },
		_view: { state: !0 },
		_cursor: { state: !0 },
		_hidden: { state: !0 },
		_month: { state: !0 },
		_monthDays: { state: !0 },
		_monthLoading: { state: !0 },
		_stream: { state: !0 },
		_hd: { state: !0 },
		_playing: { state: !0 },
		_hover: { state: !0 },
		_thumbs: { state: !0 },
		_metrics: { state: !0 }
	};
	_daySeq = 0;
	_playSeq = 0;
	_hoverSeq = 0;
	_monthSeq = 0;
	_thumbsRequested = /* @__PURE__ */ new Set();
	thumbLoader = new rn();
	_thumbPause;
	_refreshTimer;
	_lastCursorPaint = 0;
	_progressive = St();
	constructor() {
		super(), this.deviceId = "", this.cameraName = "", this._date = "", this._loading = !1, this._view = {
			start: 0,
			span: Ct
		}, this._hidden = /* @__PURE__ */ new Set();
		let e = /* @__PURE__ */ new Date();
		this._month = {
			year: e.getFullYear(),
			month: e.getMonth() + 1
		}, this._monthDays = /* @__PURE__ */ new Set(), this._monthLoading = !1, this._stream = "sub", this._hd = {
			main: !1,
			reason: "checking…"
		}, this._thumbs = /* @__PURE__ */ new Map(), this._metrics = {};
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return Qt(Date.now(), this._zone);
	}
	get _player() {
		return this.renderRoot.querySelector("rv-player");
	}
	get _timeline() {
		return this.renderRoot.querySelector("rv-timeline");
	}
	get _events() {
		return It(this._day?.events ?? [], this._hidden);
	}
	connectedCallback() {
		super.connectedCallback(), this._refreshTimer = setInterval(() => {
			this._date === this._today && document.visibilityState !== "hidden" && this._loadDay(this._date, {
				keepView: !0,
				quiet: !0
			});
		}, pn);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._refreshTimer), this._player?.stop(), this.thumbLoader.clear(), clearTimeout(this._thumbPause);
	}
	willUpdate(e) {
		if ((e.has("deviceId") || e.has("hass")) && this.hass && this.deviceId && !this._date) {
			this._date = this._today;
			let [e, t] = this._date.split("-").map(Number);
			e && t && (this._month = {
				year: e,
				month: t
			}), this._loadDay(this._date), this._loadMonth(this._month.year, this._month.month), this._checkHd();
		}
	}
	async _loadDay(e, t = {}) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._daySeq, i = performance.now(), a = !1;
		t.quiet || (this._loading = !0);
		try {
			let o = await Ie(n, this.deviceId, e, t.quiet ? 0 : 900);
			if (r !== this._daySeq) return;
			let s = !this._day || this._day.date !== o.date;
			if (this._day = o, this._error = void 0, s || !t.keepView) {
				this._view = J({
					start: o.start,
					span: o.end - o.start
				}, o);
				let e = o.events.at(-1)?.start ?? o.segments.at(-1)?.start;
				this._cursor = e;
			} else this._view = J(this._view, o);
			await this.updateComplete, t.quiet || (this._metrics = {
				...this._metrics,
				timelineMs: performance.now() - i,
				timelineServer: o.timing
			}), this._warmLongRecording(o), a = !t.quiet && o.timing.cache === "stale";
		} catch (e) {
			r === this._daySeq && (this._error = L(e).message);
		} finally {
			r === this._daySeq && (this._loading = !1);
		}
		a && await this._loadDay(e, {
			keepView: !0,
			quiet: !0
		});
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
			let i = await Fe(n, this.deviceId, e, t);
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
			let t = await Ve(e, this.deviceId);
			this._hd = await xt(t.main), this._metrics = {
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
		let t = this.hass, n = this._cursor === void 0 ? e.segments.at(-1) : Nt(e.segments, this._cursor);
		!t || !n || n.end - n.start < mn || ze(t, this._ref(n)).catch(() => void 0);
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
		let i = Ft(r.segments, e);
		if (!i) {
			H(this, "No recording after this time on this day");
			return;
		}
		let a = ++this._playSeq;
		this._playFailure = void 0, this._pauseThumbs(), this._cursor = i.segment.start + i.offset;
		let o = performance.now();
		try {
			let e = this._progressive && i.offset < 3e3, r = await Re(n, this._ref(i.segment), e);
			if (a !== this._playSeq) return;
			this._playing = r, this._metrics = {
				...this._metrics,
				urlMs: performance.now() - o,
				firstFrameMs: void 0,
				gapMs: void 0,
				stream: r.stream,
				cache: r.cache,
				codec: r.media?.codec ?? null,
				delivery: yn(e, this._progressive, r.cache.complete)
			};
			let s = Math.max(0, this._cursor - r.start);
			await this._player?.play(vn(r), s, t), this._preloadAfter(i.segment, a);
		} catch (e) {
			a === this._playSeq && this._playError(L(e).message);
		}
	}
	async _preloadAfter(e, t) {
		let n = this.hass, r = this._day?.segments ?? [], i = r.findIndex((t) => t.id === e.id), a = i >= 0 ? r.at(i + 1) : void 0;
		if (!n || !a) await this._player?.preload(void 0);
		else try {
			let e = await Re(n, this._ref(a), this._progressive);
			if (t !== this._playSeq) return;
			await this._player?.preload(vn(e));
		} catch {}
	}
	_onAdvanced(e) {
		let t = this._day?.segments.find((t) => t.id === e.segmentId);
		this._metrics = {
			...this._metrics,
			gapMs: e.gapMs
		}, t && (this._cursor = t.start, this._preloadAfter(t, this._playSeq));
	}
	_onEnded(e) {
		let t = this._day?.segments ?? [], n = t.findIndex((t) => t.id === e), r = n >= 0 ? t[n + 1] : void 0;
		r && this.playAt(r.start);
	}
	_pauseThumbs() {
		this.thumbLoader.pause(), clearTimeout(this._thumbPause), this._thumbPause = setTimeout(() => {
			this._resumeThumbs();
		}, gn);
	}
	_resumeThumbs() {
		clearTimeout(this._thumbPause), this.thumbLoader.resume();
	}
	_playError(e) {
		this._resumeThumbs(), this._stream === "main" ? (this._stream = "sub", H(this, `HD failed (${e}); back to the sub stream`, "error"), this._cursor !== void 0 && this.playAt(this._cursor)) : (this._playFailure = e, H(this, `Playback failed: ${e}`, "error"));
	}
	_onTime(e) {
		let t = performance.now();
		t - this._lastCursorPaint < 250 || (this._lastCursorPaint = t, this._cursor = e, (e > this._view.start + this._view.span || e < this._view.start) && (this._view = Ot(this._view, e, this._day ?? {
			start: e,
			end: e + this._view.span
		})));
	}
	_jump(e) {
		let t = this._cursor ?? this._view.start, n = e > 0 ? Lt(this._events, t) : Rt(this._events, t);
		n ? (this._cursor = n.start, this._day && (this._view = Ot(this._view, n.start, this._day)), this.playAt(n.start)) : H(this, e > 0 ? "No later event" : "No earlier event");
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
		this._date = e, this._player?.stop(), this._playing = void 0, this.thumbLoader.clear(), this._thumbs = /* @__PURE__ */ new Map(), this._thumbsRequested.clear(), this._loadDay(e);
		let [t, n] = e.split("-").map(Number);
		t && n && (t !== this._month.year || n !== this._month.month) && this._loadMonth(t, n);
	}
	async _onHover(e) {
		let t = this.hass;
		if (!t || !this._day || !Nt(this._day.segments, e.time)) {
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
			let i = (await Be(t, this.deviceId, [e.time], Ut(this._view.span))).urls[0]?.url;
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
				let e = await Be(t, this.deviceId, n, hn), r = this._date;
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
	_renderToolbar() {
		let e = Dt(this._view.span);
		return D`<div class="toolbar">
      <div class="group">
        <button aria-label="Previous event" title="Previous event" @click=${() => {
			this._jump(-1);
		}}>⏮</button>
        <button
          aria-label=${this._player?.paused === !1 ? "Pause" : "Play"}
          @click=${() => {
			let e = this._player;
			e?.current ? e.paused ? e.resume() : e.pause() : this._cursor !== void 0 && this.playAt(this._cursor), this.requestUpdate();
		}}
        >${this._player?.paused === !1 ? "⏸" : "▶"}</button>
        <button aria-label="Next event" title="Next event" @click=${() => {
			this._jump(1);
		}}>⏭</button>
      </div>
      <div class="group">
        <button aria-label="Zoom out" ?disabled=${e === 0} @click=${() => this._timeline?.zoom(-1)}>−</button>
        <span class="small muted zoom">${xn(this._view.span)}</span>
        <button
          aria-label="Zoom in"
          ?disabled=${e === q.length - 1}
          @click=${() => this._timeline?.zoom(1)}
        >+</button>
      </div>
      <div class="group">
        <button
          class=${this._stream === "sub" ? "primary" : ""}
          aria-pressed=${this._stream === "sub" ? "true" : "false"}
          @click=${() => {
			this._setStream("sub");
		}}
        >SD</button>
        <button
          class=${this._stream === "main" ? "primary" : ""}
          aria-pressed=${this._stream === "main" ? "true" : "false"}
          ?disabled=${!this._hd.main}
          title=${this._hd.reason}
          @click=${() => {
			this._setStream("main");
		}}
        >HD</button>
        ${this._playing ? D`<a class="button" href=${this._playing.clip_url} download>Download clip</a>` : k}
      </div>
    </div>`;
	}
	_renderFilters() {
		let e = Ht(this._day?.events ?? []);
		return e.length ? D`<div class="chips" role="group" aria-label="Event types">
      ${e.map((e) => {
			let t = !this._hidden.has(e);
			return D`<button
          class="chip ${t ? "on" : ""}"
          aria-pressed=${t ? "true" : "false"}
          style="--chip: ${X(e)}"
          @click=${() => {
				let n = new Set(this._hidden);
				t ? n.add(e) : n.delete(e), this._hidden = n;
			}}
        >
          <span class="swatch"></span>${Vt(e)}
          <span class="muted">${this._day?.events.filter((t) => t.types.includes(e)).length ?? 0}</span>
        </button>`;
		})}
    </div>` : k;
	}
	_renderHover() {
		let e = this._hover;
		return e ? D`<div class="hover" style="left: ${Math.max(0, e.x - 80)}px">
      ${e.gap ? k : e.url ? D`<img src=${e.url} alt="" />` : D`<div class="noimg"></div>`}
      <span>${Q(e.time, this._zone, !0)}${e.gap ? " · no recording" : ""}</span>
    </div>` : k;
	}
	_renderDebug() {
		let e = this._metrics, t = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, n = e.timelineServer;
		return D`<details class="debug">
      <summary class="small muted">Debug</summary>
      <dl class="facts">
        <dt>Time to timeline</dt>
        <dd>
          ${t(e.timelineMs)}
          ${n ? D`<span class="muted">(server: ${n.cache ?? "?"}${n.search_ms === void 0 ? "" : `, search ${Math.round(n.search_ms)} ms`})</span>` : k}
        </dd>
        <dt>Time to first frame</dt>
        <dd>${t(e.firstFrameMs)} <span class="muted">(URL ${t(e.urlMs)})</span></dd>
        <dt>Gap at last file change</dt>
        <dd>${t(e.gapMs)}</dd>
        <dt>Stream</dt>
        <dd>${e.stream ?? this._stream}${e.codec ? ` · ${e.codec}` : ""}</dd>
        <dt>Cache</dt>
        <dd>${e.cache ? bn(e.cache) : "–"}</dd>
        <dt>HD</dt>
        <dd>${this._hd.reason}</dd>
        <dt>Delivery</dt>
        <dd>${e.delivery ?? (this._progressive ? "progressive" : "whole file first (WebKit)")}</dd>
        <dt>Day</dt>
        <dd>
          ${this._day ? `${this._day.segments.length} recordings, ${this._day.events.length} events${this._day.complete ? ", final" : ""}${this._day.events_error ? `, event search failed (${this._day.events_error})` : ""}` : "–"}
        </dd>
      </dl>
    </details>`;
	}
	render() {
		let e = this._day, t = this._zone;
		return D`
      <div class="layout">
        <div class="main">
          <rv-player
            @rv-first-frame=${(e) => {
			this._metrics = {
				...this._metrics,
				firstFrameMs: e.detail.ms
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
			this._playError(e.detail.message);
		}}
          ></rv-player>
          <div class="dayline">
            <button class="text" aria-label="Previous day" @click=${() => {
			this._changeDay(-1);
		}}>‹</button>
            <strong>${e ? Xt(e.start + 432e5, t) : this._date}</strong>
            <button
              class="text"
              aria-label="Next day"
              ?disabled=${this._date >= this._today}
              @click=${() => {
			this._changeDay(1);
		}}
            >›</button>
            <span class="muted small">
              ${this._cursor === void 0 ? "" : Q(this._cursor, t, !0)}
              ${this._loading ? " · loading…" : ""}
            </span>
          </div>
          ${this._error ? D`<div class="banner error" role="alert">Could not load recordings: ${this._error}</div>` : k}
          ${this._playFailure ? D`<div class="banner error" role="alert">Playback failed: ${this._playFailure}</div>` : k}
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
			this._cursor = e.detail.time;
		}}
              @rv-hover=${(e) => void this._onHover(e.detail)}
              @rv-hover-end=${() => {
			this._hoverSeq += 1, this._hover = void 0;
		}}
            ></rv-timeline>
          </div>
          ${this._renderToolbar()} ${this._renderFilters()}
          ${e && !e.segments.length && !this._loading ? D`<p class="muted">No recordings on this day.</p>` : k}
          ${this._renderDebug()}
        </div>
        <div class="side">
          <rv-calendar
            .year=${this._month.year}
            .month=${this._month.month}
            .days=${this._monthDays}
            .selected=${this._date}
            .today=${this._today}
            .firstDay=${en(this.hass?.locale?.language)}
            ?loading=${this._monthLoading}
            @rv-month=${(e) => void this._loadMonth(e.detail.year, e.detail.month)}
            @rv-day=${(e) => {
			this._selectDate(e.detail.date);
		}}
          ></rv-calendar>
          <h3>Events</h3>
          <rv-event-list
            .events=${this._events}
            .thumbs=${this._thumbs}
            .current=${this._cursor}
            .timeZone=${t}
            @rv-pick=${(e) => {
			this._cursor = e.detail.event.start, this._day && (this._view = Ot(this._view, e.detail.event.start, this._day)), this.playAt(e.detail.event.start);
		}}
            @rv-thumbs-needed=${(e) => void this._loadThumbs(e.detail.times)}
          ></rv-event-list>
        </div>
      </div>
    `;
	}
	static styles = [B, o`
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 16px;
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .main,
      .side {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }
      .dayline {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .timeline-wrap {
        position: relative;
      }
      .hover {
        position: absolute;
        bottom: calc(100% + 4px);
        z-index: 2;
        width: 160px;
        background: var(--card-background-color, white);
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 6px;
        padding: 4px;
        font-size: 12px;
        text-align: center;
        pointer-events: none;
      }
      .hover img,
      .hover .noimg {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        background: var(--secondary-background-color, #eee);
        border-radius: 4px;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px;
      }
      .group {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .zoom {
        min-width: 44px;
        text-align: center;
      }
      a.button {
        padding: 6px 14px;
        border-radius: 4px;
        border: 1px solid var(--divider-color, #ccc);
        text-decoration: none;
        color: var(--primary-text-color);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 16px;
        padding: 4px 10px;
        opacity: 0.55;
      }
      .chip.on {
        opacity: 1;
        border-color: var(--chip);
      }
      .swatch {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--chip);
      }
      .debug dl {
        font-size: 13px;
      }
    `];
};
function vn(e) {
	return {
		url: e.url,
		segmentId: e.segment_id,
		start: e.start,
		end: e.end
	};
}
function yn(e, t, n) {
	return n ? "cached file (Range)" : e ? "progressive" : t ? "whole file first (to seek)" : "whole file first (WebKit)";
}
function bn(e) {
	let t = `${(e.bytes / 1e6).toFixed(1)} MB`;
	return e.error ? `failed: ${e.error}` : e.complete ? `cached (${t})` : `filling (${t} so far)`;
}
function xn(e) {
	return e >= 36e5 ? `${Math.round(e / 36e5)} h` : `${Math.round(e / G)} min`;
}
customElements.get("rv-playback") || customElements.define("rv-playback", _n);
//#endregion
//#region src/components/device-page.ts
var Sn = 1e3, Cn = class extends I {
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
		return e.size === 1 && e.has("hass") && this._renderedStates !== void 0 ? Qe(this._renderedStates, this.hass?.states, this._watched) : !0;
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
			let [e, r] = await Promise.all([Ae(t, this.deviceId), Me(t)]);
			if (n !== this._loadSeq) return;
			this._catalog = r, this._device = e, this._error = void 0, this._watched = Dn(e);
		} catch (e) {
			if (n !== this._loadSeq) return;
			this._error = L(e).message;
		}
	}
	_subscribeRegistry(e) {
		this._unsubRegistry = e.connection.subscribeEvents((e) => {
			let t = e.data?.entity_id;
			(!t || this._device?.connections.some((e) => e.entities.some((e) => e.entity_id === t))) && (clearTimeout(this._reloadTimer), this._reloadTimer = setTimeout(() => void this.reload(), Sn));
		}, "entity_registry_updated").catch(() => void 0);
	}
	render() {
		this.renderCount += 1;
		let e = this._device, t = e?.node;
		return D`
      <div class="header">
        <button class="text back" @click=${() => {
			V(this, { view: "list" });
		}} aria-label="Back to all devices">← All devices</button>
      </div>
      ${this._error ? D`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : k}
      ${t ? D`<div class="title">
              <h2>${t.name ?? "Reolink device"}</h2>
              <span class="badge">${R(t.kind)}</span>
              ${t.kind === "camera" && t.connections.length > 1 ? D`<span class="badge" title="In Home Assistant via the NVR and directly"
                    >${t.connections.length} connections</span
                  >` : k}
              <span class="muted small">${t.model ?? ""}</span>
            </div>
            <div class="tabs" role="tablist">
              ${En(e).map((e) => D`<button
                  role="tab"
                  aria-selected=${this.tab === e ? "true" : "false"}
                  class=${this.tab === e ? "active" : ""}
                  @click=${() => {
			V(this, {
				view: "device",
				id: this.deviceId,
				tab: e
			});
		}}
                >
                  ${wn[e]}
                </button>`)}
            </div>
            ${e.degraded ? D`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>` : k}
            ${this.tab === "playback" && Tn(e) ? D`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${t.id}
                  .cameraName=${t.name ?? ""}
                ></rv-playback>` : this.tab === "overview" || this.tab === "playback" ? D`<rv-overview .hass=${this.hass} .device=${e}></rv-overview>` : D`<rv-settings
                  .hass=${this.hass}
                  .device=${e}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}` : this._error ? k : D`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [B, o`
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
}, wn = {
	overview: "Overview",
	playback: "Playback",
	settings: "Settings"
};
function Tn(e) {
	return e.node.kind === "camera" && e.node.connections.some((e) => e.playback_source);
}
function En(e) {
	return Tn(e) ? [
		"overview",
		"playback",
		"settings"
	] : ["overview", "settings"];
}
function Dn(e) {
	let t = e.connections.flatMap((e) => e.entities.map((e) => e.entity_id));
	return e.node.kind === "camera" && e.node.snapshot_entity_id && t.push(e.node.snapshot_entity_id), t;
}
customElements.get("rv-device-page") || customElements.define("rv-device-page", Cn);
//#endregion
//#region src/download.ts
function On(e, t, n = document) {
	let r = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = n.createElement("a");
	a.href = i, a.download = t, a.rel = "noopener", n.body.appendChild(a), a.click(), a.remove(), setTimeout(() => {
		URL.revokeObjectURL(i);
	}, 1e3);
}
//#endregion
//#region src/reolink-viewer-panel.ts
var kn = 6e3, An = class extends I {
	static properties = {
		hass: { attribute: !1 },
		narrow: { type: Boolean },
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
	_onHashChange = () => {
		this._route = Ye(window.location.hash);
	};
	constructor() {
		super(), this.narrow = !1, this._probe = { status: "idle" }, this._includeBattery = !1, this._concurrency = !1, this._maxStreams = 4, this._playback = !1, this._playbackOnly = !1, this._playbackConcurrency = !1, this._playbackStreams = 4, this._copied = !1, this._route = { view: "list" }, this.addEventListener(Ke, (e) => {
			this.navigate(e.detail);
		}), this.addEventListener(qe, (e) => {
			this.showToast(e.detail);
		});
	}
	connectedCallback() {
		super.connectedCallback(), this._route = Ye(window.location.hash), window.addEventListener("hashchange", this._onHashChange);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener("hashchange", this._onHashChange), clearTimeout(this._toastTimer), this._run?.cancel(), this._run = void 0;
	}
	updated(e) {
		e.has("hass") && this.hass && !this._devices && !this._loading && (this._load(), Me(this.hass).catch(() => void 0));
	}
	navigate(e) {
		let t = Je(e);
		if (window.location.hash !== t) {
			let e = `${window.location.pathname}${window.location.search}${t}`;
			window.history.pushState(null, "", e);
		}
		e.view === "list" && this._route.view === "device" && this._load(), this._route = e;
	}
	showToast(e) {
		clearTimeout(this._toastTimer), this._toast = e, this._toastTimer = setTimeout(() => {
			this._toast = void 0;
		}, kn);
	}
	async _load() {
		if (this.hass) {
			this._loading = !0;
			try {
				this._devices = await ke(this.hass), this._loadError = void 0, !this._warmed && !this._devices.degraded && (this._warmed = !0, Le(this.hass).catch(() => void 0));
			} catch (e) {
				this._loadError = L(e).message;
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
		return D`
      <div class="toolbar">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">Reolink</div>
        ${e.view === "list" ? D`<button class="text" @click=${() => void this._load()} ?disabled=${this._loading}>
              Refresh
            </button>` : k}
      </div>
      <main>
        ${e.view === "device" ? D`<rv-device-page
              .hass=${this.hass}
              .deviceId=${e.id}
              .tab=${e.tab}
            ></rv-device-page>` : D`${this._renderBanner()}
              ${this._loadError ? k : D`<rv-device-list .devices=${this._devices}></rv-device-list>`}
              ${this._isAdmin ? this._renderProbe() : k}`}
      </main>
      ${this._toast ? D`<div class="toast ${this._toast.kind}" role="status" aria-live="polite">
            <span>${this._toast.message}</span>
            <button class="text" aria-label="Dismiss" @click=${() => {
			this._toast = void 0;
		}}>✕</button>
          </div>` : k}
    `;
	}
	_renderBanner() {
		if (this._loadError) return D`<div class="banner error" role="alert">
        Could not load devices: ${this._loadError}
      </div>`;
		let e = this._devices;
		return e?.degraded ? D`<div class="banner warning" role="alert">
      <strong>Degraded mode.</strong> The Reolink integration's internals changed in this
      Home Assistant release, so only the device registry's information is shown, duplicate
      cameras are not merged and the probe is disabled. Settings still work.
      <ul>
        ${e.compat.errors.map((e) => D`<li>${e}</li>`)}
      </ul>
    </div>` : k;
	}
	_renderProbe() {
		let e = this._probe.status === "running", t = e || !this._devices || this._devices.degraded;
		return D`<section class="card">
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
		].map((e) => D`<option value=${e} ?selected=${e === this._maxStreams}>${e}</option>`)}
        </select>
        sub streams at once on one camera per device, stopping at the first failure
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${this._playback}
          ?disabled=${e}
          @change=${(e) => {
			this._playback = e.target.checked;
		}}
        />
        Test recording playback: HTTP range requests, MP4 layout, download speed and a
        day of file sizes, on one recent recording per camera (main and sub)
      </label>
      <label class="nested">
        <input
          type="checkbox"
          .checked=${this._playbackOnly}
          ?disabled=${e || !this._playback}
          @change=${(e) => {
			this._playbackOnly = e.target.checked;
		}}
        />
        Only this test (skip the live and recorded-video method tests)
      </label>
      <label class="nested">
        <input
          type="checkbox"
          .checked=${this._playbackConcurrency}
          ?disabled=${e || !this._playback}
          @change=${(e) => {
			this._playbackConcurrency = e.target.checked;
		}}
        />
        Test simultaneous playback: plays up to
        <select
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
		].map((e) => D`<option value=${e} ?selected=${e === this._playbackStreams}>${e}</option>`)}
        </select>
        recordings at once, one per camera, stopping at the first failure
      </label>
      <div class="actions">
        ${e ? D`<button @click=${() => {
			this._cancelProbe();
		}}>
              Cancel
            </button>` : D`<button class="primary" ?disabled=${t} @click=${() => {
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
			case "idle": return k;
			case "running": return D`<div class="progress" aria-live="polite">
          <p>Probing… this can take several minutes on an NVR.</p>
          <ol class="log">
            ${e.log.map((e) => D`<li>${e}</li>`)}
          </ol>
        </div>`;
			case "error": return D`<div class="banner error" role="alert">Probe failed: ${e.message}</div>`;
			case "done": return D`<div class="done">
          <p>
            Done. The report was saved as <code>${e.filename}</code>. If your browser or
            the Companion app blocked the download, use Copy JSON instead.
          </p>
          <div class="actions">
            <button @click=${() => {
				On(e.report, e.filename);
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
		let t = Pe(this.hass, {
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
			let n = Ge(/* @__PURE__ */ new Date());
			this._probe = {
				status: "done",
				report: e,
				filename: n
			}, On(e, n);
		}, (e) => {
			this._run === t && (this._run = void 0, this._probe = {
				status: "error",
				message: L(e).message
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
	static styles = [B, o`
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
      label.nested {
        margin-inline-start: 24px;
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
customElements.get("reolink-viewer-panel") || customElements.define("reolink-viewer-panel", An);
//#endregion
export { An as ReolinkViewerPanel };
