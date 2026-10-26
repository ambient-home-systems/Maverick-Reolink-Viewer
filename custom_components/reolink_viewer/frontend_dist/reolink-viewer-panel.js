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
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, h = globalThis, g = h.trustedTypes, ee = g ? g.emptyScript : "", _ = h.reactiveElementPolyfillSupport, v = (e, t) => e, y = {
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
}, te = (e, t) => !l(e, t), b = {
	attribute: !0,
	type: String,
	converter: y,
	reflect: !1,
	useDefault: !1,
	hasChanged: te
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var x = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = b) {
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
		return this.elementProperties.get(e) ?? b;
	}
	static _$Ei() {
		if (this.hasOwnProperty(v("elementProperties"))) return;
		let e = m(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(v("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(v("properties"))) {
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
			let i = (n.converter?.toAttribute === void 0 ? y : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? y : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? te)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
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
x.elementStyles = [], x.shadowRootOptions = { mode: "open" }, x[v("elementProperties")] = /* @__PURE__ */ new Map(), x[v("finalized")] = /* @__PURE__ */ new Map(), _?.({ ReactiveElement: x }), (h.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var S = globalThis, ne = (e) => e, re = S.trustedTypes, ie = re ? re.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, ae = "$lit$", C = `lit$${Math.random().toFixed(9).slice(2)}$`, w = "?" + C, oe = `<${w}>`, T = document, se = () => T.createComment(""), ce = (e) => e === null || typeof e != "object" && typeof e != "function", le = Array.isArray, ue = (e) => le(e) || typeof e?.[Symbol.iterator] == "function", de = "[ 	\n\f\r]", fe = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, pe = /-->/g, me = />/g, E = RegExp(`>|${de}(?:([^\\s"'>=/]+)(${de}*=${de}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), he = /'/g, ge = /"/g, _e = /^(?:script|style|textarea|title)$/i, ve = (e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}), D = ve(1), ye = ve(2), O = Symbol.for("lit-noChange"), k = Symbol.for("lit-nothing"), be = /* @__PURE__ */ new WeakMap(), A = T.createTreeWalker(T, 129);
function xe(e, t) {
	if (!le(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return ie === void 0 ? t : ie.createHTML(t);
}
var Se = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = fe;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === fe ? c[1] === "!--" ? o = pe : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = E) : (_e.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = E) : o = me : o === E ? c[0] === ">" ? (o = i ?? fe, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? E : c[3] === "\"" ? ge : he) : o === ge || o === he ? o = E : o === pe || o === me ? o = fe : (o = E, i = void 0);
		let d = o === E && e[t + 1].startsWith("/>") ? " " : "";
		a += o === fe ? n + oe : l >= 0 ? (r.push(s), n.slice(0, l) + ae + n.slice(l) + C + d) : n + C + (l === -2 ? t : d);
	}
	return [xe(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, Ce = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = Se(t, n);
		if (this.el = e.createElement(l, r), A.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = A.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(ae)) {
					let t = u[o++], n = i.getAttribute(e).split(C), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? De : r[1] === "?" ? Oe : r[1] === "@" ? ke : Ee
					}), i.removeAttribute(e);
				} else e.startsWith(C) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (_e.test(i.tagName)) {
					let e = i.textContent.split(C), t = e.length - 1;
					if (t > 0) {
						i.textContent = re ? re.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], se()), A.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], se());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === w) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(C, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += C.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = T.createElement("template");
		return n.innerHTML = e, n;
	}
};
function j(e, t, n = e, r) {
	if (t === O) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = ce(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = j(e, i._$AS(e, t.values), i, r)), t;
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? T).importNode(t, !0);
		A.currentNode = r;
		let i = A.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new Te(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Ae(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = A.nextNode(), a++);
		}
		return A.currentNode = T, r;
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
		e = j(this, e, t), ce(e) ? e === k || e == null || e === "" ? (this._$AH !== k && this._$AR(), this._$AH = k) : e !== this._$AH && e !== O && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? ue(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== k && ce(this._$AH) ? this._$AA.nextSibling.data = e : this.T(T.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = Ce.createElement(xe(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new we(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = be.get(e.strings);
		return t === void 0 && be.set(e.strings, t = new Ce(e)), t;
	}
	k(t) {
		le(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(se()), this.O(se()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = ne(e).nextSibling;
			ne(e).remove(), e = t;
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
		this.type = 1, this._$AH = k, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = k;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = j(this, e, t, 0), a = !ce(e) || e !== this._$AH && e !== O, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = j(this, r[n + o], t, o), s === O && (s = this._$AH[o]), a ||= !ce(s) || s !== this._$AH[o], s === k ? e = k : e !== k && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === k ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, De = class extends Ee {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === k ? void 0 : e;
	}
}, Oe = class extends Ee {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== k);
	}
}, ke = class extends Ee {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = j(this, e, t, 0) ?? k) === O) return;
		let n = this._$AH, r = e === k && n !== k || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== k && (n === k || r);
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
		j(this, e);
	}
}, je = S.litHtmlPolyfillSupport;
je?.(Ce, Te), (S.litHtmlVersions ??= []).push("3.3.3");
var Me = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new Te(t.insertBefore(se(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Ne = globalThis, M = class extends x {
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
		return O;
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
}), Ue = (e) => e.callWS({ type: "reolink_viewer/timeline/warm" }), We = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/playback/url",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	progressive: n,
	...r === void 0 ? {} : { at: Math.round(r) }
}), Ge = (e, t, n) => e.callWS({
	type: "reolink_viewer/playback/mse",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	...n === void 0 ? {} : { at: Math.round(n) }
});
function Ke(e) {
	return e.split("?")[0]?.split("/").at(-1) ?? "";
}
var qe = (e, t) => e.callWS({
	type: "reolink_viewer/playback/release",
	tokens: t
}), Je = (e, t) => e.callWS({
	type: "reolink_viewer/playback/cache_status",
	token: t
}), Ye = (e, t) => e.callWS({
	type: "reolink_viewer/playback/prefetch",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream
}), Xe = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/thumbnail/urls",
	device_id: t,
	times: n,
	bucket: r
}), Ze = (e, t) => e.callWS({
	type: "reolink_viewer/playback/media_info",
	device_id: t
}), Qe = (e) => e.callWS({ type: "reolink_viewer/live/status" }), $e = (e) => e.callWS({ type: "reolink_viewer/live/cameras" }), et = (e) => ({
	connection_id: e.connectionId,
	stream: e.stream
}), tt = (e, t) => e.callWS({
	type: "reolink_viewer/live/mse",
	...et(t)
}), nt = (e, t) => e.callWS({
	type: "reolink_viewer/live/frame",
	...et(t)
}), rt = (e, t) => e.callWS({
	type: "reolink_viewer/live/state",
	...et(t)
}), it = (e) => e.callWS({ type: "reolink_viewer/live/soak" }), at = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/soak/count",
	device: t,
	...n
}), ot = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/soak/start",
	device: t,
	grid_open: n
}), st = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/preload",
	...et(t),
	enabled: n
}), ct = (e) => e.callWS({ type: "web_rtc/ice_servers" }), lt = (e, t, n, r) => e.connection.subscribeMessage(r, {
	type: "reolink_viewer/live/webrtc",
	...et(t),
	offer: n
}), ut = (e, t, n) => e.callWS({
	type: "reolink_viewer/live/candidate",
	session_id: t,
	candidate: n
}), dt = (e, t) => e.connection.subscribeMessage(t, { type: "reolink_viewer/live/images" }), ft = (e, t, n, r = {}) => e.connection.subscribeMessage(n, {
	type: "reolink_viewer/live/capacity",
	host_id: t,
	...r
}), pt = {
	camera: "Camera",
	nvr: "NVR",
	hub: "Home Hub"
}, mt = (e) => pt[e];
function ht(e) {
	let t = [];
	return e.codec && t.push(gt(e.codec)), e.width && e.height && t.push(`${e.width}×${e.height}`), e.frame_rate && t.push(`${e.frame_rate} fps`), e.bit_rate && t.push(`${e.bit_rate} kbps`), t.length ? t.join(" · ") : "unknown";
}
function gt(e) {
	switch (e.toLowerCase()) {
		case "h264": return "H.264";
		case "h265":
		case "hevc": return "H.265";
		default: return e;
	}
}
function _t(e) {
	return e === null ? "unknown" : e ? "on" : "off";
}
function vt(e) {
	return `reolink-viewer-probe-${e.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
}
//#endregion
//#region src/styles.ts
var P = o`
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
`, yt = "rv-navigate", bt = "rv-toast";
function F(e, t) {
	e.dispatchEvent(new CustomEvent(yt, {
		detail: t,
		bubbles: !0,
		composed: !0
	}));
}
function I(e, t, n = "info") {
	e.dispatchEvent(new CustomEvent(bt, {
		detail: {
			message: t,
			kind: n
		},
		bubbles: !0,
		composed: !0
	}));
}
function xt(e) {
	return e.view === "live-check" ? "#live-check" : e.view === "soak" ? "#soak" : e.view === "live" ? "#live" : e.view === "list" ? "" : `#device/${encodeURIComponent(e.id)}/${e.tab}`;
}
function St(e) {
	if (e === "#live-check") return { view: "live-check" };
	if (e === "#soak") return { view: "soak" };
	if (e === "#live") return { view: "live" };
	let t = /^#device\/([^/]+)(?:\/(overview|live|settings|playback))?$/.exec(e);
	if (!t?.[1]) return { view: "list" };
	let n = t[2];
	return {
		view: "device",
		id: decodeURIComponent(t[1]),
		tab: n === "live" || n === "settings" || n === "playback" ? n : "overview"
	};
}
//#endregion
//#region src/components/device-list.ts
var Ct = class extends M {
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
			F(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}>
          ${e.name ?? e.entry_title}
        </button>
        <span class="badge">${mt(e.kind)}</span>
      </div>
      <p class="muted small">
        ${[e.model, e.sw_version && `firmware ${e.sw_version}`].filter(Boolean).join(" · ")}
      </p>
      ${n.length ? D`<ul class="devices">
            ${n.map((t) => this._renderCamera(t, e))}
          </ul>` : D`<p class="muted">No cameras on this ${mt(e.kind)}.</p>`}
    </section>`;
	}
	_renderCamera(e, t) {
		let n = t ? e.connections.find((e) => e.host_id === t.id)?.channel : void 0, r = t !== void 0 && e.connections.some((e) => e.via === "direct");
		return D`<li>
      <button
        class="row"
        @click=${() => {
			F(this, {
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
          ${wt(e)}
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
	static styles = [P, o`
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
function wt(e) {
	let t = e.status;
	return t.online === !1 ? D`<span class="badge warning">offline</span>` : t.sleeping ? D`<span class="badge">sleeping</span>` : k;
}
customElements.get("rv-device-list") || customElements.define("rv-device-list", Ct);
//#endregion
//#region src/render-filter.ts
function Tt(e, t, n) {
	if (e === t) return !1;
	if (!e || !t) return !0;
	for (let r of n) if (e[r] !== t[r]) return !0;
	return !1;
}
//#endregion
//#region src/live/check-util.ts
var Et = [
	"avc1.640029",
	"avc1.64002A",
	"avc1.640033",
	"hvc1.1.6.L153.B0",
	"mp4a.40.2",
	"mp4a.40.5",
	"flac",
	"opus"
];
function Dt(e, t = !1) {
	return Et.filter((n) => (!t || /^(avc1|hvc1)\./.test(n)) && e(`video/mp4; codecs="${n}"`)).join(",");
}
function Ot(e) {
	return [/live check (v[\w.-]+)/.exec(e)?.[1], /^Browser: (.+?)(?: · |$)/m.exec(e)?.[1]].filter((e) => e !== void 0).join(" · ");
}
function kt(e) {
	let t = 0, n = 0, r = !1;
	for (let i of e) for (let e of Array.isArray(i.urls) ? i.urls : [i.urls]) /^turns?:/i.test(e) ? n += 1 : /^stun:/i.test(e) && (t += 1), /nabucasa|nabu\.casa/i.test(e) && (r = !0);
	return [`${t} STUN`, `${n} TURN${r && n ? " (Nabu Casa)" : ""}`].join(", ");
}
function At(e) {
	return e.map((e) => ({
		urls: e.urls,
		...e.username ? { username: e.username } : {},
		...e.credential ? { credential: e.credential } : {}
	}));
}
function jt(e) {
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
function L(e) {
	return e === void 0 ? "–" : `${(e / 1e3).toFixed(2)} s`;
}
function Mt(e) {
	if (!e.length) return;
	let t = [...e].sort((e, t) => e - t), n = Math.floor(t.length / 2);
	return t.length % 2 ? t[n] : ((t[n - 1] ?? 0) + (t[n] ?? 0)) / 2;
}
function Nt(e) {
	if (!e) return "";
	let t = [
		e.key_interval_ms === null ? void 0 : `key frames every ${L(e.key_interval_ms)}`,
		e.parameter_sets === null ? void 0 : `parameter sets: ${e.parameter_sets}`,
		e.frame_order ? `frame order: ${e.frame_order}` : void 0,
		e.ends ? `feed ended ${String(e.ends)}× (${e.last_end ?? "?"})` : void 0,
		`feed opened ${L(e.age_ms)} before`
	].filter(Boolean);
	return t.length ? `; ${t.join("; ")}` : "";
}
function Pt(e, t) {
	if (!t) return e;
	let n = [
		t.codec,
		t.width && t.height ? `${t.width}×${t.height}` : void 0,
		t.frame_rate ? `${t.frame_rate} fps` : void 0,
		t.bit_rate ? `${t.bit_rate} kbps` : void 0
	].filter(Boolean);
	return n.length ? `${e} (${n.join(", ")})` : e;
}
function Ft(e) {
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
function It(e, t) {
	let n = new URL(e, t);
	return n.protocol = n.protocol === "https:" ? "wss:" : "ws:", n.toString();
}
//#endregion
//#region src/live/data.ts
var Lt = class {
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
		let n = dt(e, (e) => {
			t === this._run && (this.images = {
				...this.images,
				...e.images
			}, this._host.requestUpdate());
		}), r = ct(e).then(At, () => []);
		try {
			let [i, { cameras: a }, o] = await Promise.all([
				n,
				$e(e),
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
function Rt(e, t) {
	let n = t.keep_warm_entity;
	return n && e?.states[n]?.state === "on" ? !0 : R(t)?.streams.sub?.warm === !0;
}
function R(e) {
	return e.connections.find((e) => e.via === "nvr") ?? e.connections[0];
}
function zt(e, t) {
	return e.find((e) => e.id === t || e.connections.some((e) => e.connection_id === t));
}
var Bt = 6e4;
function Vt(e) {
	let { samples: t, run: n } = e, r = e.sampleS * 1e3, i = [`Reolink Viewer soak report v${e.version} · ${new Date(e.now).toLocaleString()}`], a = 0;
	if (n) {
		let t = Math.max(0, e.now - n.started_at);
		a = Math.min(n.visible_ms, t) / 36e5;
		let r = Object.entries(n.devices).sort(([, e], [, t]) => t - e);
		i.push(`Soak started ${new Date(n.started_at).toLocaleString()} (${Ht(t)} h ago) · grid open ${Ht(n.open_ms)} h, visible ${a.toFixed(1)} h · opened ${n.opens} time${n.opens === 1 ? "" : "s"}`, `Reported by: ${r.length ? r.map(([t, n]) => `${t} (${Ut(e.now - n)})`).join(", ") : "no grid yet"}`);
	} else i.push("No grid has reported yet: open Reolink → Watch live and leave it showing; its hours add up.");
	let o = t.at(0), s = t.at(-1);
	if (!o || !s) {
		let t = Math.round(e.warmupS / 60);
		return i.push("", e.startedAt === null ? `No samples yet: Home Assistant is still starting. The first comes ${t} minutes after it has, once live view is up.` : `No samples yet: Home Assistant started at ${new Date(e.startedAt).toLocaleString()}. The first comes ${t} minutes after, once live view is up (go2rtc and the kept-warm feeds).`), i.join("\n");
	}
	let c = s.at - o.at;
	i.push(`Home Assistant's samples: ${t.length} over ${Ht(c)} h, since ${new Date(o.at).toLocaleString()} (every ${Math.round(e.sampleS / 60)} min; the last ${Math.round(e.keepS / 3600)} h are kept)`, "");
	let l = [], u = t.map((e) => e.go2rtc.memory_kb).filter((e) => e !== null), d = s.go2rtc.restarts - o.go2rtc.restarts, f = t.filter((e) => e.go2rtc.state !== "running").length;
	i.push(`go2rtc: ${s.go2rtc.state} · restarts ${o.go2rtc.restarts} → ${s.go2rtc.restarts}` + (u.length ? ` · memory ${z(u[0] ?? 0)} → ${z(u.at(-1) ?? 0)} MB (peak ${z(Math.max(...u))} MB)` : " · memory not known")), l.push(d === 0 && f === 0 ? ["✓", "go2rtc ran throughout: no restart"] : ["✗", `go2rtc restarted ${d} time${d === 1 ? "" : "s"}${f ? `, and was not running in ${f} sample${f === 1 ? "" : "s"}` : ""}`]);
	let p = u.at(0), m = u.at(-1);
	p !== void 0 && m !== void 0 && l.push(m <= p * 2 ? ["✓", `go2rtc's memory steady: ${z(p)} → ${z(m)} MB`] : ["⚠", `go2rtc's memory grew: ${z(p)} → ${z(m)} MB`]), i.push(`WebRTC sessions: ${o.webrtc_sessions} → ${s.webrtc_sessions} (peak ${((e) => Math.max(...t.map(e)))((e) => e.webrtc_sessions)})`, `MSE feeds: ${o.feeds.feeds} → ${s.feeds.feeds}, kept warm ${o.feeds.warm} → ${s.feeds.warm}, viewers ${o.feeds.viewers} → ${s.feeds.viewers} · feeds dropped ${o.feeds.ends} → ${s.feeds.ends}`, "Stream slots in use (the sessions to the cameras), per host:");
	let h = t.filter((e) => e.webrtc_sessions === 0 && e.feeds.viewers === 0), g = h.at(0), ee = h.at(-1), _ = h.length >= 2 && g !== void 0 && ee !== void 0, v = _ ? g : o, y = _ ? ee : s, te = (e, t) => e.hosts.find((e) => e.name === t)?.streams ?? 0, b = [], x = [], S = [], ne = [], re = [...new Set(t.flatMap((e) => e.hosts.map((e) => e.name)))];
	for (let e of re) {
		let n = t.map((t) => t.hosts.find((t) => t.name === e)), r = n.find((e) => e !== void 0), a = n.at(-1), o = a?.limit ?? r?.limit ?? 0, s = Math.max(...n.map((e) => e?.streams ?? 0)), c = Math.max(...n.map((e) => e?.waiting ?? 0)), l = n.map((e) => e?.cpu).filter((e) => e != null);
		i.push(`  ${e}: ${n[0]?.streams ?? 0} → ${a?.streams ?? 0} of ${o} (peak ${s}${c ? `, up to ${c} waiting` : ""}) · CPU ${l.length ? `${l.at(0)}% → ${l.at(-1)}% (peak ${Math.max(...l)}%)` : "not reported"}`);
		let u = te(v, e), d = te(y, e);
		x.push(`${e} ${u} → ${d}`), d > u && b.push(`${e} ${u} → ${d}`), n.some((e) => e !== void 0 && e.streams > e.limit) && S.push(e), l.length && ne.push(`${e} peak ${Math.max(...l)}%`);
	}
	_ && i.push(`While nobody watched (${h.length} samples, ${new Date(v.at).toLocaleString()} → ${new Date(y.at).toLocaleString()}): ${x.join(", ")}`), l.push(b.length ? ["✗", _ ? `Camera sessions grew while nobody watched: ${b.join(", ")}` : `Camera sessions grew: ${b.join(", ")} (close full screen before the report)`] : ["✓", _ ? "No growth in camera sessions: while nobody watched, no host held more stream slots at the end than at the start" : "No growth in camera sessions: each host ends with no more stream slots in use than it started with"], S.length ? ["✗", `Above the stream limit: ${S.join(", ")}`] : ["✓", "Within the stream limits: no host above its limit"], ["–", `Camera CPU (Phase 0 set no CPU limit): ${ne.length ? ne.join(", ") : "not reported (the hosts' CPU sensors are off)"}`]);
	let ie = [...new Set(t.flatMap((e) => e.battery.map((e) => e.camera)))];
	ie.length || (i.push("Battery cameras: none on battery"), l.push(["–", "Battery cameras: none on battery"]));
	for (let e of ie) {
		let n = t.map((t) => t.battery.find((t) => t.camera === e)).filter((e) => e !== void 0).filter((e) => !e.watched), r = n.filter((e) => e.sleeping === !0).length;
		i.push(`Battery camera ${e}: asleep in ${r} of ${n.length} samples while not watched`), l.push(n.length ? r ? ["✓", `${e} slept while not watched`] : ["✗", `${e} never slept while not watched`] : ["–", `${e}: watched in every sample`]);
	}
	let ae = Object.entries(n?.tiles ?? {});
	i.push("Tiles (plays · drops · failed starts):"), ae.length || i.push(n ? "  none counted yet" : "  no grid yet");
	let C = [];
	for (let [e, t] of ae) {
		i.push(`  ${e}: ${t.plays} · ${t.drops} · ${t.failures}`);
		let n = t.drops + t.failures;
		n > Math.max(2, a) && C.push(`${e} (${n} in ${a.toFixed(1)} h)`);
	}
	l.unshift(n ? C.length ? ["✗", `Reconnect loops: ${C.join(", ")}`] : ["✓", "No reconnect loops: no tile dropped or failed to start more than once an hour"] : ["–", "Reconnect loops: no grid has reported yet"]);
	let w = c / 36e5;
	l.push(w >= 24 ? ["✓", `Home Assistant ran live view ${w.toFixed(1)} h (24 needed)`] : ["✗", `Home Assistant's samples cover ${w.toFixed(1)} h of 24: it has to run that long without restarting (no page needs to be open)`], n ? a >= 8 ? ["✓", `The grid was visible ${a.toFixed(1)} h (8 needed), opened ${n.opens} time${n.opens === 1 ? "" : "s"}`] : ["✗", `The grid has been visible ${a.toFixed(1)} h of 8: open it whenever it suits; the hours add up across sittings and devices`] : ["✗", "The grid has been visible 0.0 h of 8: no grid has reported yet"]), n && e.startedAt !== null && e.startedAt > n.started_at + r && l.push(["–", `Home Assistant started again at ${new Date(e.startedAt).toLocaleString()}, after the soak began: its samples start then; the grid's hours carry on`]);
	let oe = Math.floor(c / r) + 1;
	t.length < .9 * oe && l.push(["⚠", `${t.length} samples of about ${oe} in ${w.toFixed(1)} h: sampling stopped for a while`]);
	let T = l.filter(([e]) => e === "✗").length;
	return i.push("", "Verdict:", ...l.map(([e, t]) => `${e} ${t}`)), i.push("", T ? `Not passed: ${T} ${T === 1 ? "criterion" : "criteria"} not met.` : "Passed."), i.join("\n");
}
function Ht(e) {
	return (Math.max(0, e) / 36e5).toFixed(1);
}
function z(e) {
	return (e / 1024).toFixed(1);
}
function Ut(e) {
	let t = Math.max(0, e) / 6e4;
	return t < 1 ? "now" : t < 60 ? `${Math.floor(t)} min ago` : `${(t / 60).toFixed(1)} h ago`;
}
var B = new class {
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
	constructor(e = () => Wt(navigator.userAgent), t = () => Date.now()) {
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
		}, Bt);
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
			await at(e, this._device(), t);
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
function Wt(e) {
	let t = /iPhone/.test(e) ? "iPhone" : /iPad/.test(e) ? "iPad" : /Android/.test(e) ? "Android" : /Macintosh|Mac OS X/.test(e) ? "Mac" : /Windows/.test(e) ? "Windows" : /Linux|X11/.test(e) ? "Linux" : "Browser", n = /Home ?Assistant\//.test(e) ? "Home Assistant app" : /Edg(A|iOS)?\//.test(e) ? "Edge" : /Firefox\/|FxiOS\//.test(e) ? "Firefox" : /Chrome\/|CriOS\//.test(e) ? "Chrome" : /Safari\//.test(e) ? "Safari" : void 0;
	return n ? `${t} · ${n}` : t;
}
//#endregion
//#region src/clipboard.ts
async function Gt(e) {
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
//#region src/playback/check-util.ts
function Kt(e) {
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
var qt = (e) => /iPhone|iPad|iPod/.test(e);
function Jt(e) {
	return qt(e) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}
function Yt(e, t) {
	return e.startsWith("iPhone") ? !qt(t) : e.startsWith("Desktop") ? qt(t) : !1;
}
function Xt(e) {
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
var V = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, H = (e) => e === void 0 ? "–" : Math.abs(e) >= 1e9 ? `${(e / 1e9).toFixed(2)} GB` : `${(e / 1e6).toFixed(1)} MB`;
function U(e) {
	return e < 6e4 ? `${Math.round(e / 1e3)} s` : `${(e / 6e4).toFixed(1)} min`;
}
function Zt(e, t, n, r, i) {
	let a = e.end - e.start, o = e.start + a * n, s = e.start + a * r, c = t.filter((e) => e.start >= o && e.start <= s).at(-1);
	return {
		time: c ? c.start : Math.round(e.start + a * i),
		event: c
	};
}
function Qt(e, t) {
	return e.filter((e) => e.end - e.start >= 12e5 && t - e.end > 6e4).sort((e, t) => t.start - e.start);
}
function $t(e) {
	let t = [];
	return e.forEach((n, r) => {
		let i = e.at(r + 1);
		i && i.start - n.end < 2e3 && t.push([n, i]);
	}), t.sort((e, t) => e[0].end - e[0].start - (t[0].end - t[0].start));
}
function en(e) {
	return e.decoded && e.mediaS > 0 ? e.decoded / e.mediaS : void 0;
}
function tn(e) {
	let t = [`${(e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0).toFixed(2)}× effective`];
	e.applied !== e.rate && t.push(`browser set ${e.applied}×`);
	let n = en(e);
	if (e.painted !== void 0) {
		let r = `${(e.painted * 1e3 / e.wallMs).toFixed(0)} fps painted`;
		t.push(n ? `${r} of ${(n * e.rate).toFixed(0)}` : r);
	}
	if (e.maxGapMs !== void 0 && t.push(`longest frame gap ${Math.round(e.maxGapMs)} ms`), e.decoded !== void 0 && e.dropped !== void 0) {
		let n = e.decoded ? (e.dropped * 100 / e.decoded).toFixed(1) : "0.0";
		t.push(`dropped ${e.dropped} of ${e.decoded} frames (${n} %)`);
	}
	return t.push(`${e.stalls} stalls${e.stalls ? ` (${Math.round(e.stalledMs)} ms)` : ""}`), e.ended && t.push("the file ended"), rn(e) || t.push("the dropped-frame counter disagrees with the frames painted: judged by those"), e.focused || t.push("PAGE NOT IN FRONT"), `${String(e.rate).padStart(3)}×: ${t.join(", ")}`;
}
var nn = "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % (or 1 frame) dropped, or 90 % painted where the dropped-frame counter disagrees with the frames painted";
function rn(e) {
	if (e.painted === void 0 || e.decoded === void 0 || e.dropped === void 0) return !0;
	let t = e.decoded - e.dropped;
	return Math.abs(t - e.painted) <= Math.max(3, e.decoded * .1);
}
function an(e) {
	let t = e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0;
	if (Math.abs(t - e.rate) > e.rate * .1 || e.stalledMs >= 100) return !1;
	let n = en(e), r = n === void 0 ? void 0 : n * e.rate;
	if (r !== void 0 && e.maxGapMs !== void 0) {
		let t = Math.max(250, 2500 / Math.min(r, 60));
		if (e.maxGapMs > t) return !1;
	}
	return r === void 0 || r > 50 ? !0 : !rn(e) && e.painted !== void 0 ? e.painted * 1e3 / e.wallMs >= r * .9 : !e.decoded || (e.dropped ?? 0) <= Math.max(1, e.decoded * .02);
}
function on(e) {
	if (e.length < 2) return;
	let t = e.length, n = e.reduce((e, [t]) => e + t, 0) / t, r = e.reduce((e, [, t]) => e + t, 0) / t, i = 0, a = 0;
	for (let [t, o] of e) i += (t - n) * (o - r), a += (t - n) ** 2;
	return a ? i / a : void 0;
}
function sn(e) {
	let t = 0;
	for (let n = 0; n < e.length; n += 1) t += e.end(n) - e.start(n);
	return t;
}
var W = (e, t) => e === void 0 ? "not measured" : `${V(e)} ${e < t ? "✓" : "✗"}`, cn = class extends Error {}, ln = 4e3, un = 2e4, dn = 12e4, fn = 16777216, pn = 50331648, mn = 1e3;
function G() {
	let e = window;
	if (typeof e.ManagedMediaSource == "function") return "ManagedMediaSource";
	if (typeof e.MediaSource == "function") return "MediaSource";
}
function hn(e) {
	return window[e];
}
function gn(e) {
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
function _n(e, t) {
	let n = Math.min(30 * Math.max(1, e), 240);
	return t > 0 ? Math.max(4, Math.min(n, pn / t)) : n;
}
function vn(e) {
	return e instanceof DOMException && e.name === "QuotaExceededError";
}
var yn = class {
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
		if (!t) throw new cn("this browser has no MediaSource");
		this.stats.api = t;
		let n = hn(t), r = new n();
		this._source = r, this._video.disableRemotePlayback = !0, this._url = URL.createObjectURL(r);
		let i = new Promise((e) => {
			r.addEventListener("sourceopen", () => {
				e();
			}, { once: !0 });
		});
		if (this._video.src = this._url, await i, this._gone()) return;
		let a = await this._get("init"), o = a.headers.get("X-RV-Mime") ?? "";
		if (this.stats.mime = o, !o || !n.isTypeSupported(o)) throw new cn(`MSE cannot play ${o || "this recording"}`);
		let s = new Uint8Array(await a.arrayBuffer());
		if (!this._gone()) {
			this._buffer = r.addSourceBuffer(o), this._src.durationMs > 0 && (r.duration = this._src.durationMs / 1e3);
			for (let e of [
				"timeupdate",
				"seeking",
				"ratechange",
				"progress"
			]) this._listen(this._video, e, this._pump);
			this._listen(this._video, "waiting", this._jumpGap), this._listen(r, "startstreaming", this._pump), this._listen(this._buffer, "updateend", this._pump), this._listen(this._buffer, "bufferedchange", this._pump), await this._append(s), await this._fetch({ at: e }, ln, !0), e > 0 && this._video.currentTime === 0 && (this._video.currentTime = e / 1e3), this._ready = !0, this._pump();
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
			throw e.startsWith("not playable as fragments") ? new cn(e) : Error(`HTTP ${n.status}${e ? `: ${e}` : ""}`);
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
			e && n !== void 0 && t >= e.atS - .5 && t < e.atS + .5 ? this._fetch({ first: e.index }, ln, !1) : this._fetch({ at: t * 1e3 }, ln, !1);
			return;
		}
		if (this._trim(t, n)) return;
		if (this._endS !== void 0 && n.end >= this._endS - .5) {
			this._endOfStream();
			return;
		}
		if (this._source?.streaming === !1 || n.end - t >= _n(this._video.playbackRate, this._bytesPerSecond)) return;
		let i = this._next, a = i && Math.abs(i.atS - n.end) < .5 ? { first: i.index } : { at: n.end * 1e3 }, o = Math.min(un * Math.max(1, this._video.playbackRate), dn);
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
			let n = await this._get(`frags?${o}&ms=${Math.round(t)}&bytes=${fn}`, r.signal), i = new Uint8Array(await n.arrayBuffer());
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
				this._settle(r), setTimeout(this._pump, mn);
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
				if (!vn(n)) throw n;
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
				e.removeEventListener("updateend", r), n(new cn("append error"));
			};
			e.addEventListener("updateend", r, { once: !0 }), e.addEventListener("error", i, { once: !0 });
		}) : Promise.resolve();
	}
	async _removeAllBut(e, t) {
		let n = this._video.currentTime;
		for (let r of gn(e.buffered)) {
			let i = Math.max(r.start, n - t), a = Math.min(r.end, n + t);
			a <= i ? (this._remove(e, r.start, r.end), await this._idle(e)) : (i > r.start && (this._remove(e, r.start, i), await this._idle(e)), r.end > a && (this._remove(e, a, r.end), await this._idle(e)));
		}
		this.stats.trims += 1;
	}
	_trim(e, t) {
		let n = this._buffer;
		if (!n) return !1;
		for (let r of gn(n.buffered)) if (r.start !== t.start && (r.end < e - 30 || r.start > e + 240)) return this._remove(n, r.start, r.end), this.stats.trims += 1, !0;
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
		if (t) return gn(t.buffered).find((t) => e >= t.start - .05 && e < t.end);
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
};
//#endregion
//#region src/playback/codec.ts
function bn() {
	let e = navigator.mediaCapabilities, t = e?.decodingInfo;
	return t ? t.bind(e) : void 0;
}
async function xn(e, t = bn()) {
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
function Sn(e = navigator.userAgent) {
	return !(/AppleWebKit/.test(e) && !/Chrome|Chromium|CriOS|Edg|Android|FxiOS/.test(e));
}
//#endregion
//#region src/live/hd.ts
var Cn = 4096, wn = Et.find((e) => e.startsWith("hvc1.")) ?? "hvc1.1.6.L153.B0";
async function Tn(e, t = bn()) {
	let n = (t) => e.streams.ext ? {
		stream: "ext",
		reason: `ext: ${t}`
	} : {
		stream: null,
		reason: `SD only: ${t}, and there is no ext stream`
	}, r = e.streams.main;
	if (!r) return n("no main stream");
	let i = r.encoding, a = i?.width ?? void 0, o = i?.height ?? void 0, s = a && o ? `${a}×${o}` : void 0;
	if (a && a > 4096) return n(`the main stream's ${s ?? `${a} pixels`} is wider than ${Cn} pixels`);
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
				contentType: `video/mp4; codecs="${wn}"`,
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
//#region src/live/session.ts
var En = 10, Dn = 2, On = .5, kn = 1e4;
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
		return this.pc ? { pair: jt(await this.pc.getStats()) } : {};
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
			}), this._unsubscribe = await lt(this._hass, e, n.sdp ?? "", (e) => {
				this._signal(e);
			}), this.closed && this._unsubscribe();
		} catch (e) {
			this.fail(N(e).message);
		}
	}
	async _send(e) {
		this._session && !this.closed && await ut(this._hass, this._session, e).catch(() => void 0);
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
			let { path: t } = await tt(this._hass, e);
			if (this.step("url"), this.closed) return;
			let r = new WebSocket(It(t, this._base));
			r.binaryType = "arraybuffer", this._ws = r, r.addEventListener("open", () => {
				this.step("open");
				let e = Dt((e) => n.isTypeSupported(e), this._videoOnly);
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
}, In = "0.15.1", Ln = "Live check · ", Rn = [
	"Desktop Chrome, LAN",
	"Desktop Chrome, Tailscale",
	"Desktop Chrome, Nabu Casa",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
], zn = 2e4, Bn = 12e3, Vn = 1e4, Hn = 2e3, Un = 15e3, Wn = 1e3, Gn = 1e4, Kn = class extends Error {}, qn = (e) => new Promise((t) => setTimeout(t, e)), Jn = class {
	_hass;
	options;
	_stage;
	_onChange;
	id;
	lines = [];
	running = !1;
	status = "";
	afterFrameMs = 300;
	_stopped = !1;
	_session;
	_lastSave = 0;
	_saving = Promise.resolve();
	_ice = [];
	_measured = [];
	_posters = [];
	_capacity = [];
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
			await this._header();
			let e = await this._cameras();
			await this._ourImages(e), await this._hdChoices(e);
			for (let t of e) for (let e of t.connections) for (let n of this.options.streams) await this._measureStream(t, e, n);
			this.options.capacity && await this._capacityTests(), this._summary(e);
		} catch (e) {
			this._log(e instanceof Kn ? "Stopped." : `Check failed: ${N(e).message}`);
		} finally {
			this._session?.close(), await this._go2rtcLog(), this.running = !1, this.status = "", this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0);
		}
		return this.text;
	}
	async _go2rtcLog() {
		let e = (await Qe(this._hass).catch(() => void 0))?.go2rtc.log;
		if (e?.length) {
			this._log(""), this._log(`go2rtc log (last ${String(e.length)} lines):`);
			for (let t of e) this._log(`  ${t}`);
		}
	}
	_log(e) {
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > Gn && this._save(!1);
	}
	_status(e) {
		this.status = e, this._onChange();
	}
	_save(e) {
		return this._lastSave = performance.now(), this._saving = this._saving.then(() => this._hass.callWS({
			type: "reolink_viewer/playback/check_report",
			report_id: this.id,
			setup: `${Ln}${this.options.setup}`,
			text: this.text,
			done: e
		})).then(() => void 0).catch(() => void 0), this._saving;
	}
	_checkStopped() {
		if (this._stopped) throw new Kn();
	}
	async _header() {
		let e = this._hass.user?.is_admin === !0;
		this._log(`Reolink Viewer live check v${In} · ${this.options.setup} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${Xt(navigator.userAgent)} · page ${Kt(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x`), this._log(`User agent: ${navigator.userAgent}`);
		let t = G(), n = t ? window[t] : void 0;
		this._log(`MSE: ${t ?? "none"}${n ? `, takes ${Dt((e) => n.isTypeSupported(e)) || "none of go2rtc's codecs"}` : ""}`), this._log(`WebRTC receives: ${Zn()}`);
		let r = await ct(this._hass).catch(() => []);
		this._ice = At(r), this._log(`ICE servers (Home Assistant's): ${kt(r)}`);
		let i = this.options;
		this._log(`Streams: ${i.streams.join(", ")} · warm: ${i.warm && e ? "yes" : e ? "no" : "no (not an admin)"} · Home Assistant's view: ${i.stock ? "yes" : "no"} · capacity test: ${i.capacity && e ? "yes" : "no"}`);
		let a = performance.now(), o = (await Qe(this._hass)).go2rtc;
		this._log(`go2rtc: ${o.state}${o.version ? ` ${o.version}` : ""}${o.binary ? ` (${o.binary === "system" ? "Home Assistant's binary" : "downloaded, checksum verified"})` : ""}${o.error ? ` · error: ${o.error}` : ""} · restarts ${o.restarts} · WebRTC port ${o.webrtc_port} · status in ${Math.round(performance.now() - a)} ms`);
	}
	async _cameras() {
		let { cameras: e } = await $e(this._hass), t = this.options.cameraIds?.length ? new Set(this.options.cameraIds) : void 0, n = e.filter((e) => !t || t.has(e.id));
		return this._log(`Cameras: ${n.map((e) => `${e.name}${e.connections.length > 1 ? ` (${e.connections.map((e) => e.via).join(" + ")})` : ""}`).join(", ")}`), n;
	}
	async _ourImages(e) {
		this._checkStopped(), this._status("our pictures");
		let t = /* @__PURE__ */ new Map(), n, r = () => void 0, i = performance.now(), a;
		this._log("");
		try {
			a = await dt(this._hass, (e) => {
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
			let r = i + Un;
			for (; n === void 0 && performance.now() < r;) await o();
			if (n === void 0) {
				this._log(`First images (ours): no list in ${L(Un)}`);
				return;
			}
			this._log(`First images (ours, kept on the server): listed in ${Math.round(n)} ms`);
			for (let r of e) {
				this._checkStopped();
				let e = performance.now();
				for (; !t.has(r.id) && performance.now() < e + Un;) await o();
				let i = t.get(r.id);
				if (!i) {
					this._log(`  ${r.name}: none in ${L(Un)}`);
					continue;
				}
				let a = performance.now() - e, s = await Qn(i.url);
				s.ms !== void 0 && this._posters.push({
					kind: "ours",
					ms: n + a + s.ms
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
			let e = R(t);
			e && this._log(`  ${t.name}: ${(await Tn(e)).reason}`);
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
		this._log(`${e.name}${e.model ? ` (${e.model})` : ""} · ${a} · ${Pt(n, i.encoding)}`);
		let o = `${e.name} ${a} ${n}`, s = (r, i, a) => {
			this._measured.push({
				camera: e.name,
				connection: t,
				stream: n,
				phase: r,
				transport: i,
				result: a
			});
		}, c = [], l = (e.keep_warm_entity ? this._hass.states[e.keep_warm_entity]?.state === "on" : !1) && n === "sub" && R(e) === t, u = l ? "kept warm by its switch; turn it off to measure cold" : "a viewer kept it running";
		for (let e of ["WebRTC", "MSE"]) {
			this._status(`${o}: cold ${e}`);
			let t = !l && await this._waitCold(r), n = await this._session_(e, r, zn);
			s("cold", e, n), c.push(`${e} ${Yn(n)}${t ? "" : ` (${u}: not cold)`}`), e === "MSE" && c.push(...await this._videoOnly(n, r, zn, o));
		}
		if (this._log(`  cold: ${c.join(" · ")}`), this.options.stock) {
			let e = i.entity_id;
			if (!e) this._log(`  Home Assistant's view: no enabled camera entity for ${n}`);
			else {
				this._status(`${o}: Home Assistant's view`);
				let t = await this._stockPoster(e), n = await this._stock(e);
				s("stock", "WebRTC", n), this._log(`  Home Assistant's view (${e}): snapshot ${t} · WebRTC ${Yn(n)}`);
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
				({key_frame: n} = await st(this._hass, r, !0));
			} catch (e) {
				this._log(`  warm: keeping it warm failed: ${N(e).message}`);
				return;
			}
			let i = performance.now() - e;
			try {
				await this._pause(Hn);
				let e = await this._frame(r), t = [];
				for (let e of ["WebRTC", "MSE"]) {
					this._status(`${o}: warm ${e}`);
					let n = await this._session_(e, r, Bn);
					s("warm", e, n), t.push(`${e} ${Yn(n)}`), e === "MSE" && t.push(...await this._videoOnly(n, r, Bn, o));
				}
				let a = (await rt(this._hass, r).catch(() => void 0))?.cache, c = n ? `key frame cached in ${L(i)}` : `no key frame in ${L(i)}`;
				this._log(`  warm (${c}${Nt(a)}): frame ${e} · ${t.join(" · ")}`);
			} finally {
				await st(this._hass, r, !1).catch(() => void 0);
			}
		}
	}
	async _waitCold(e) {
		let t = performance.now() + Vn;
		for (; performance.now() < t;) {
			if (this._checkStopped(), !(await rt(this._hass, e).catch(() => void 0))?.state?.active) return !0;
			await qn(250);
		}
		return !1;
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await qn(Math.min(250, t - performance.now()));
	}
	async _session_(e, t, n) {
		return this._watch((r) => e === "WebRTC" ? new Nn(this._hass, r, t, this._ice, n) : new Fn(this._hass, r, t, n));
	}
	async _videoOnly(e, t, n, r) {
		return !e.ok || e.firstFrameMs === void 0 || !("appended" in e.steps) || e.firstFrameMs - e.steps.appended <= Wn ? [] : (this._status(`${r}: MSE video only`), [`MSE video only ${Yn(await this._watch((e) => new Fn(this._hass, e, t, n, location.href, !0)))}`]);
	}
	_stock(e) {
		return this._watch((t) => new Pn(this._hass, t, e, zn));
	}
	async _watch(e) {
		this._checkStopped();
		let t = document.createElement("video");
		this._stage.replaceChildren(t);
		let n = e(t);
		this._session = n;
		try {
			let e = await n.done;
			return e.ok && await qn(this.afterFrameMs), e;
		} finally {
			n.close(), this._session = void 0, t.remove();
		}
	}
	async _stockPoster(e) {
		let t = this._hass.states[e]?.attributes.entity_picture;
		if (typeof t != "string") return "no picture";
		let n = await Qn(`${t}${t.includes("?") ? "&" : "?"}_=${Date.now()}`);
		return n.ms !== void 0 && this._posters.push({
			kind: "HA snapshot",
			ms: n.ms
		}), n.text;
	}
	async _frame(e) {
		try {
			let { path: t } = await nt(this._hass, e), n = await Qn(t);
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
				for (let e of Ft(n)) this._log(e);
			}
		}
	}
	_capacity_(e, t) {
		return new Promise((n) => {
			let r, i = !1, a = (e) => {
				i || (i = !0, r?.().catch(() => void 0), n(e));
			};
			ft(this._hass, e, (e) => {
				e.type === "progress" ? t(e.message) : e.type === "result" ? a(e.report) : a(e.message);
			}).then((e) => {
				r = e, i && e().catch(() => void 0);
			}).catch((e) => {
				a(N(e).message);
			});
		});
	}
	_summary(e) {
		let t = this._measured;
		this._log(""), this._log("Summary:");
		let n = t.filter((e) => e.transport === "WebRTC" && e.phase !== "stock"), r = n.filter((e) => "connected" in e.result.steps), i = Xn(r.map((e) => `${e.result.pair?.local ?? "?"} ↔ ${e.result.pair?.remote ?? "?"}`));
		this._log(`- WebRTC connected ${r.length} of ${n.length} sessions${i ? ` (${i})` : ""}`);
		for (let e of ["cold", "warm"]) for (let n of ["WebRTC", "MSE"]) for (let r of [["sub"], ["main", "ext"]]) {
			let i = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0), a = t.filter((t) => t.phase === e && t.transport === n && r.includes(t.stream)).length;
			a && this._log(`- ${e} ${n}, ${r.join("/")}: median ${L(Mt(i))}, ${i.length} of ${a} played` + (i.length ? ` (${L(Math.min(...i))}–${L(Math.max(...i))})` : ""));
		}
		let a = t.filter((e) => e.phase === "stock");
		if (a.length) {
			let e = 0, n = 0;
			for (let r of a) {
				let i = t.filter((e) => e.connection === r.connection && e.stream === r.stream && e.phase !== "stock" && e.result.ok), a = i.length ? Math.min(...i.map((e) => e.result.firstFrameMs ?? Infinity)) : void 0;
				a !== void 0 && r.result.ok && (n += 1, a < (r.result.firstFrameMs ?? Infinity) && (e += 1));
			}
			let r = a.filter((e) => e.result.ok).map((e) => e.result.firstFrameMs ?? 0);
			this._log(`- Home Assistant's view: median ${L(Mt(r))}, ${r.length} of ${a.length} played; ours (best of cold/warm) faster on ${e} of ${n}`);
		}
		for (let e of [
			"ours",
			"HA snapshot",
			"go2rtc frame"
		]) {
			let t = this._posters.filter((t) => t.kind === e).map((e) => e.ms);
			t.length && this._log(`- first image, ${e}: median ${L(Mt(t))} (${t.length}), slowest ${L(Math.max(...t))}`);
		}
		for (let n of e.filter((e) => e.connections.length > 1)) {
			let e = n.connections.map((e) => {
				let n = Mt(t.filter((t) => t.connection === e && t.stream === "sub" && t.phase === "cold" && t.result.ok).map((e) => e.result.firstFrameMs ?? 0));
				return `${e.via === "nvr" ? "via NVR" : "direct"} cold sub ${L(n)}`;
			});
			this._log(`- ${n.name}: ${e.join(" vs ")}`);
		}
		for (let { host: e, report: t } of this._capacity) {
			let n = t.verdict;
			this._log(`- capacity ${e}: ${n.first_failing_level === null ? `kept up at every level (${t.levels.length})` : `level ${n.first_failing_level} fails or slows down (${n.reasons.join("; ")})`}`);
		}
	}
};
function Yn(e) {
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
	return e.ok ? `${L(e.firstFrameMs)}${a ? ` (${a})` : ""}` : `✗ ${e.error ?? "failed"}${a ? ` (${a})` : ""}`;
}
function Xn(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.set(n, (t.get(n) ?? 0) + 1);
	return [...t].map(([e, t]) => `${t}× ${e}`).join(", ");
}
function Zn() {
	let e = typeof RTCRtpReceiver < "u" ? RTCRtpReceiver.getCapabilities("video") : null;
	return e ? [...new Set(e.codecs.map((e) => e.mimeType.replace(/^video\//, "")).filter((e) => !/rtx|red|ulpfec|flexfec/i.test(e)))].join(", ") : "unknown";
}
function Qn(e) {
	return new Promise((t) => {
		let n = performance.now(), r = new Image(), i = setTimeout(() => {
			t({ text: "timed out" });
		}, Un);
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
//#region src/components/live-soak.ts
var $n = "rv-live-soak-close", er = class extends M {
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
				await B.flush(e);
				let t = await it(e);
				this._state = { text: Vt({
					version: In,
					now: Date.now(),
					sampleS: t.sample_s,
					keepS: t.keep_s,
					warmupS: t.warmup_s,
					startedAt: t.started_at,
					run: t.run,
					samples: t.now ? [...t.samples, t.now] : t.samples
				}) };
			} catch (e) {
				this._state = { error: N(e).message };
			}
		}
	}
	async _startOver() {
		let e = this.hass;
		if (this._confirm = !1, e) {
			B.discard();
			try {
				await ot(e, Wt(navigator.userAgent), B.open), await this.refresh();
			} catch (e) {
				this._state = { error: N(e).message };
			}
		}
	}
	render() {
		let e = this._state, t = typeof e == "object" && "text" in e ? e : void 0;
		return D`<div class="card" role="region" aria-label="Soak report">
      ${e === "loading" ? D`<p class="muted">Reading the soak run…</p>` : "error" in e ? D`<div class="banner error" role="alert">Could not make the soak report: ${e.error}</div>` : D`<pre>${e.text}</pre>`}
      <div class="actions">
        ${t ? D`<button
              @click=${() => {
			Gt(t.text).then((e) => {
				this._state = {
					...t,
					copied: e
				};
			});
		}}
            >
              ${t.copied === void 0 ? "Copy" : t.copied ? "Copied" : "Could not copy"}
            </button>` : k}
        <button
          @click=${() => {
			this.refresh();
		}}
        >
          Refresh
        </button>
        ${this._confirm ? D`<span class="confirm">
              Start the soak over? What was counted is dropped.
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
            </span>` : D`<button
              @click=${() => {
			this._confirm = !0;
		}}
            >
              Start over…
            </button>`}
        ${this.closable ? D`<button
              @click=${() => {
			this.dispatchEvent(new CustomEvent($n, {
				bubbles: !0,
				composed: !0
			}));
		}}
            >
              Close
            </button>` : k}
      </div>
    </div>`;
	}
	static styles = [P, o`
      :host {
        display: block;
      }
      pre {
        margin: 0 0 8px;
        font-size: 12px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
        align-items: center;
      }
      .confirm {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
    `];
};
customElements.get("rv-live-soak") || customElements.define("rv-live-soak", er);
//#endregion
//#region src/live/player.ts
var tr = {
	WebRTC: 15e3,
	MSE: 12e3
}, nr = [
	1,
	2,
	5,
	10,
	30
], rr = (e, t, n, r, i, a) => e === "MSE" ? new Fn(t, n, r, a) : new Nn(t, n, r, i, a), ir = class {
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
	constructor(e, t, n, r, i = () => void 0, a = rr) {
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
			let t = this._factory(r, this._hass, this._video, this.ref, this.options.iceServers, tr[r]);
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
		let n = nr[Math.min(this._failures, nr.length) - 1] ?? nr[0];
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
}, ar = 5e3, or = [
	"left_up",
	"up",
	"right_up",
	"left",
	null,
	"right",
	"left_down",
	"down",
	"right_down"
], sr = {
	left: 0,
	left_up: 45,
	up: 90,
	right_up: 135,
	right: 180,
	right_down: 225,
	down: 270,
	left_down: 315
}, cr = {
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
}, lr = class extends M {
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
		!this._moving && t && this._usable(t) && (this._moving = e, this._movement = this._call("button", "press", t, cr[e].toLowerCase()));
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
		}, ar);
	}
	_step(e, t, n) {
		let r = this._state(e), i = Number(r?.state);
		if (!r || !Number.isFinite(i)) return;
		let a = r.attributes, o = a.min ?? 0, s = a.max ?? 100, c = Math.max(a.step ?? 1, Math.round((s - o) / 10)), l = Math.min(s, Math.max(o, i + t * c));
		l !== i && this._call("number", "set_value", e, n, { value: l });
	}
	render() {
		let e = this.controls ?? {};
		return D`${this._renderTop(e)} ${this._renderPad(e)} ${this._renderZoom(e)}
    ${this._confirmSiren ? this._renderConfirm() : k}
    ${this._error ? D`<div class="error" role="alert">${this._error}</div>` : k}`;
	}
	_renderTop(e) {
		let { preset: t, floodlight: n, siren: r } = e;
		if (!t && !n && !r) return k;
		let i = this._state(t)?.attributes?.options ?? [], a = this._state(n)?.state === "on", o = this._state(r)?.state === "on";
		return D`<div class="top">
      ${t && i.length ? D`<select
            aria-label="Go to a preset"
            ?disabled=${!this._usable(t)}
            @change=${(e) => {
			let n = e.target, r = n.value;
			n.value = "", r && this._call("select", "select_option", t, "go to the preset", { option: r });
		}}
          >
            <option value="">Preset…</option>
            ${i.map((e) => D`<option value=${e}>${e}</option>`)}
          </select>` : k}
      ${n ? D`<button
            class="toggle ${a ? "on" : ""}"
            aria-pressed=${a ? "true" : "false"}
            ?disabled=${!this._usable(n)}
            @click=${() => {
			this._call("light", a ? "turn_off" : "turn_on", n, "switch the floodlight");
		}}
          >
            Light
          </button>` : k}
      ${r ? D`<button
            class="toggle siren ${o ? "on" : ""}"
            aria-pressed=${o ? "true" : "false"}
            ?disabled=${!this._usable(r)}
            @click=${() => {
			o ? this._call("siren", "turn_off", r, "stop the siren") : this._confirmSiren = !0;
		}}
          >
            ${o ? "Stop siren" : "Siren"}
          </button>` : k}
    </div>`;
	}
	_renderConfirm() {
		let e = this.controls?.siren;
		return D`<div class="confirm" role="alertdialog" aria-labelledby="siren-title">
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
		return t?.stop ? D`<div class="pad" role="group" aria-label="Move the camera">
      ${or.map((e) => e && t[e] ? this._holdButton(e, D`<svg viewBox="0 0 24 24" aria-hidden="true" style="transform: rotate(${sr[e] ?? 0}deg)">
              ${ye`<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`}
            </svg>`) : D`<span></span>`)}
    </div>` : k;
	}
	_renderZoom(e) {
		let t = e.ptz, n = t?.stop && t.zoom_in && t.zoom_out, r = n ? void 0 : e.zoom, i = e.focus;
		if (!n && !r && !i) return k;
		let a = (e, t, n) => D`<span class="stepper" role="group" aria-label=${n}>
        <button
          aria-label=${`${n} out`}
          ?disabled=${!this._usable(e)}
          @click=${() => {
			this._step(e, -1, t);
		}}
        >
          −
        </button>
        <span class="small">${n}</span>
        <button
          aria-label=${`${n} in`}
          ?disabled=${!this._usable(e)}
          @click=${() => {
			this._step(e, 1, t);
		}}
        >
          +
        </button>
      </span>`;
		return D`<div class="zoom">
      ${i ? a(i, "focus", "Focus") : k}
      ${n ? D`<span class="stepper" role="group" aria-label="Zoom">
            ${this._holdButton("zoom_out", D`−`)}<span class="small">Zoom</span>${this._holdButton("zoom_in", D`+`)}
          </span>` : r ? a(r, "zoom", "Zoom") : k}
    </div>`;
	}
	_holdButton(e, t) {
		let n = this.controls?.ptz?.[e];
		return D`<button
      class="hold ${this._moving === e ? "held" : ""}"
      aria-label=${cr[e]}
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
	static styles = [P, o`
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
        color: #fff;
      }
      .top,
      .pad,
      .zoom,
      .confirm,
      .error {
        position: absolute;
        pointer-events: auto;
      }
      button,
      select {
        border: none;
        border-radius: 16px;
        background: rgba(0, 0, 0, 0.5);
        color: #fff;
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
        background: var(--primary-color);
      }
      .toggle.siren.on {
        background: var(--error-color, #db4437);
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
        border-radius: 50%;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
      }
      .hold.held {
        background: var(--primary-color);
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
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.8);
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
        background: var(--error-color, #db4437);
      }
      .error {
        left: 50%;
        top: 44px;
        transform: translateX(-50%);
        max-width: 90%;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 13px;
        background: var(--error-color, #db4437);
      }
    `];
};
customElements.get("rv-live-controls") || customElements.define("rv-live-controls", lr);
//#endregion
//#region src/live/debug.ts
var ur = (e) => `${(e / 1e3).toFixed(e < 1e4 ? 2 : 0)} s`;
function dr(e, t, n = Date.now()) {
	let r = e.connection, i = [`${e.camera}${r ? ` · ${r.via === "nvr" ? "through the NVR" : "direct"} (${r.entry_title})${r.is_battery ? " · on battery" : ""}` : ""}`];
	for (let r of e.players) {
		if (i.push(`${r.label} (${r.stream}, ${r.warm ? "kept warm" : "cold"}): ${fr(r.state, n)}`), r.state.kind === "playing") {
			let e = r.state.result.pair;
			e?.local && i.push(`  path: ${e.local} ↔ ${e.remote ?? "?"}${e.rttMs === void 0 ? "" : `, rtt ${e.rttMs} ms`}`);
		}
		i.push(`  server: ${pr(t[r.label])}`);
	}
	e.hd && i.push(`HD choice: ${e.hd}`);
	for (let t of e.players) if (t.events.length) {
		i.push(`Events (${t.label}):`);
		for (let e of t.events) i.push(`  ${mr(e.at)} ${e.text}`);
	}
	return i.join("\n");
}
function fr(e, t) {
	switch (e.kind) {
		case "idle": return "stopped";
		case "starting": return `starting over ${e.transport}`;
		case "waiting": return `${e.error}; next try in ${ur(Math.max(0, e.retryAt - t))}`;
		case "playing": {
			let t = e.result, n = t.width ?? t.pair?.width, r = t.height ?? t.pair?.height, i = t.pair?.codec ?? /codecs="?([^"]+)/.exec(t.mse?.mime ?? "")?.[1];
			return [
				`playing over ${e.transport}`,
				t.firstFrameMs === void 0 ? void 0 : `first frame in ${ur(t.firstFrameMs)}`,
				n && r ? `${n}×${r}` : void 0,
				i
			].filter((e) => e !== void 0).join(" · ");
		}
	}
}
function pr(e) {
	if (e === void 0) return "…";
	if (typeof e == "string") return `cannot read: ${e}`;
	let t = [e.state ? `go2rtc ${e.state.active ? "streaming" : "idle"}, ${e.state.consumers} consumer${e.state.consumers === 1 ? "" : "s"}` : "not in go2rtc", `held ${e.holds}×`], n = e.cache;
	return n ? (t.push(`${n.warm ? "warm feed" : "feed"} ${ur(n.age_ms)} old, ${n.viewers} viewer${n.viewers === 1 ? "" : "s"}`), n.key_frame_age_ms !== null && t.push(`key frame ${ur(n.key_frame_age_ms)} ago${n.key_interval_ms === null ? "" : `, every ${ur(n.key_interval_ms)}`}`), n.parameter_sets && t.push(`parameter sets ${n.parameter_sets}`), n.ends && t.push(`${n.ends} feed${n.ends === 1 ? "" : "s"} dropped (last: ${n.last_end ?? "?"})`)) : t.push("no MSE feed"), t.join(", ");
}
function mr(e) {
	return new Date(e).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	});
}
//#endregion
//#region src/components/live-debug.ts
var hr = 2e3, gr = "rv-live-debug-close", _r = class extends M {
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
		}, hr);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._timer);
	}
	async _poll() {
		let e = this.hass, t = this.info, n = t?.connection;
		if (!e || !t || !n) return;
		let r = async (t) => {
			try {
				return await rt(e, {
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
		let e = this.info, t = e ? dr(e, this._states) : "";
		return D`<div class="panel" role="dialog" aria-label=${`${e?.camera ?? "Camera"}: debug`}>
      <pre>${t}</pre>
      <div class="actions">
        <button
          @click=${() => {
			Gt(t).then((e) => {
				this._copied = e;
			});
		}}
        >
          ${this._copied === void 0 ? "Copy" : this._copied ? "Copied" : "Could not copy"}
        </button>
        <button
          @click=${() => {
			this.dispatchEvent(new CustomEvent(gr, {
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
	static styles = [P, o`
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
customElements.get("rv-live-debug") || customElements.define("rv-live-debug", _r);
//#endregion
//#region src/components/live-tile.ts
var vr = 3e3, yr = "rv-live-open", br = "rv-live-full", xr = "rv-live-count", Sr = class extends M {
	static properties = {
		hass: { attribute: !1 },
		camera: { attribute: !1 },
		connection: { attribute: !1 },
		stream: { attribute: !1 },
		image: { attribute: !1 },
		iceServers: { attribute: !1 },
		warm: { attribute: !1 },
		openable: { type: Boolean },
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
		super(), this.stream = "sub", this.openable = !1, this.suspended = !1, this._state = { kind: "idle" }, this._hdState = { kind: "idle" }, this._onScreen = typeof IntersectionObserver > "u", this._pageVisible = document.visibilityState !== "hidden", this._wanted = !0, this._full = !1, this._debug = !1;
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
		this.dispatchEvent(new CustomEvent(xr, {
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
		this.dispatchEvent(new CustomEvent(br, {
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
		}, vr)));
	}
	_driveHd() {
		let e = this.connection, t = this._full && this.shouldPlay;
		t && e && !this._hd && this._hdChoosing !== e && (this._hdChoosing = e, Tn(e).then((t) => {
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
		if (this.hass && e && t) return this._player = new ir(this.hass, e, {
			connectionId: t.connection_id,
			stream: this.stream
		}, {
			warm: !1,
			iceServers: []
		}, (e) => {
			this._state = e;
		}), this._player.onCount = this._count, this._player;
	}
	_ensureHdPlayer() {
		if (this._hdPlayer) return this._hdPlayer;
		let e = this._hd?.stream, t = this.renderRoot.querySelector("video.hd"), n = this.connection;
		if (this.hass && e && t && n) return this._hdPlayer = new ir(this.hass, t, {
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
		this._full || (this._wanted ? this.openable && this.camera && this.dispatchEvent(new CustomEvent(yr, {
			detail: { cameraId: this.camera.id },
			bubbles: !0,
			composed: !0
		})) : this._wanted = !0);
	}
	render() {
		let e = this._state, t = e.kind === "playing", n = this.camera?.name ?? "Camera", r = !this._full && (this.openable || !this._wanted);
		return D`<div class="frame">
      <div
        class="tile ${t ? "playing" : ""} ${this.hdShown ? "hd-on" : ""}"
        role=${r ? "button" : k}
        tabindex=${r ? "0" : k}
        aria-label=${r ? this._wanted ? `Open ${n}` : `Watch ${n}` : k}
        @click=${() => {
			this._activate();
		}}
        @keydown=${(e) => {
			(e.key === "Enter" || e.key === " ") && (e.preventDefault(), this._activate());
		}}
      >
        ${this.image ? D`<img class="poster" src=${this.image.url} alt="" />` : k}
        <video class="sub" muted playsinline aria-label=${`${n} live`}></video>
        ${this._hd?.stream ? D`<video class="hd" muted playsinline aria-label=${`${n} live in HD`}></video>` : k}
        <div class="label">${n}</div>
        ${this.hdShown ? k : this._renderStatus(e)}
        ${this._renderHd()}
      </div>
      ${this._debug ? D`<rv-live-debug
            .hass=${this.hass}
            .info=${this._debugInfo(n)}
            @rv-live-debug-close=${() => {
			this._debug = !1;
		}}
          ></rv-live-debug>` : k}
      <button
        class="corner-button info"
        aria-label=${`${n} debug info`}
        aria-pressed=${this._debug ? "true" : "false"}
        title="What this tile plays, and how"
        @click=${() => {
			this._debug = !this._debug;
		}}
      >
        ${Er(wr)}
      </button>
      ${this.controls && (this._full || !this.openable) ? D`<rv-live-controls
            .hass=${this.hass}
            .controls=${this.controls}
            .cameraName=${n}
          ></rv-live-controls>` : k}
      <button
        class="corner-button full"
        aria-label=${this._full ? "Exit full screen" : `${n} full screen`}
        title=${this._full ? "Exit full screen" : "Full screen (HD)"}
        @click=${() => {
			this._full ? this.exitFull() : this.enterFull();
		}}
      >
        ${Er(this._full ? Tr : Cr)}
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
		if (!this._full) return k;
		let e = this._hd, t = this._hdState, n = "SD", r;
		return this.hdShown ? n = "HD" : r = e ? e.stream ? t.kind === "waiting" ? `HD cannot play: ${t.error}` : "HD starting…" : e.reason : "Choosing the HD stream…", D`<div class="hd-status" title=${e?.reason ?? k}>
      <span class="badge ${this.hdShown ? "accent" : ""}">${n}</span>
      ${r ? D`<span class="small">${r}</span>` : k}
    </div>`;
	}
	_renderStatus(e) {
		if (!this._wanted) {
			if (!this.connection?.is_battery) {
				let e = this.image ? new Date(this.image.taken).toLocaleTimeString([], {
					hour: "numeric",
					minute: "2-digit"
				}) : void 0;
				return D`<div class="status picture">
          <span class="badge">${e ? `Picture from ${e}` : "No picture yet"}</span>
          <span class="badge accent">Tap to watch live</span>
        </div>`;
			}
			return D`<div class="status center">
        <span class="badge">Tap to watch</span>
        <span class="small">Battery camera: it wakes when you watch it</span>
      </div>`;
		}
		return this.connection?.streams[this.stream] ? e.kind === "starting" ? D`<div class="status corner">
        <span class="spinner" aria-label="Connecting"></span>
      </div>` : e.kind === "waiting" ? D`<div class="status center" role="alert">
        <span class="small">Cannot play: ${e.error}</span>
        <button
          @click=${(e) => {
			e.stopPropagation(), this._player?.retryNow();
		}}
        >
          Retry now
        </button>
      </div>` : k : D`<div class="status center">
        <span class="badge">No ${this.stream} stream</span>
      </div>`;
	}
	static styles = [P, o`
      :host {
        display: block;
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
        border-radius: 0;
      }
      .tile {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
        color: #fff;
      }
      .tile[role="button"] {
        cursor: pointer;
      }
      .tile:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
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
      .corner-button {
        position: absolute;
        right: 6px;
        bottom: 6px;
        width: 36px;
        height: 36px;
        padding: 6px;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
      }
      .corner-button.info {
        bottom: 46px;
        width: 30px;
        height: 30px;
        right: 9px;
        padding: 4px;
        opacity: 0.8;
      }
      .corner-button.info[aria-pressed="true"] {
        background: var(--primary-color);
        opacity: 1;
      }
      .corner-button.info svg {
        width: 22px;
        height: 22px;
      }
      .corner-button svg {
        display: block;
        width: 24px;
        height: 24px;
      }
      .label {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 16px 8px 4px;
        font-size: 13px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
        pointer-events: none;
      }
      .status {
        position: absolute;
        display: flex;
        gap: 6px;
      }
      .status.center {
        inset: 0;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 8px;
        background: rgba(0, 0, 0, 0.45);
      }
      .status.corner {
        top: 8px;
        right: 8px;
      }
      .status.picture {
        top: 8px;
        left: 8px;
        flex-wrap: wrap;
      }
      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        video {
          transition: none;
        }
        .spinner {
          animation: none;
        }
      }
    `];
}, Cr = "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5", wr = "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 11v6M12 7.5v.5", Tr = "M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5";
function Er(e) {
	return D`<svg viewBox="0 0 24 24" aria-hidden="true">
    ${ye`<path d=${e} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`}
  </svg>`;
}
customElements.get("rv-live-tile") || customElements.define("rv-live-tile", Sr);
//#endregion
//#region src/components/live-grid.ts
var Dr = class extends M {
	static properties = {
		hass: { attribute: !1 },
		_full: { state: !0 },
		_soak: { state: !0 }
	};
	_data = new Lt(this);
	constructor() {
		super(), this._soak = !1;
	}
	connectedCallback() {
		super.connectedCallback(), B.opened(() => this.hass, document.visibilityState !== "hidden"), document.addEventListener("visibilitychange", this._onVisibility), this._flush();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), document.removeEventListener("visibilitychange", this._onVisibility), B.closed(), this._flush();
	}
	_onVisibility = () => {
		let e = document.visibilityState !== "hidden";
		B.visibility(e), e || this._flush();
	};
	_flush() {
		this.hass && B.flush(this.hass);
	}
	willUpdate() {
		this._data.hass = this.hass;
	}
	render() {
		let e = this._data, t = e.cameras;
		return D`<div class="header">
        <button
          class="text back"
          @click=${() => {
			F(this, { view: "list" });
		}}
        >
          ← Devices
        </button>
        <h2>Live</h2>
        <button
          class="text soak-button"
          title="After 24 hours with the grid open: did live view hold up?"
          @click=${() => {
			this._soak = !0;
		}}
        >
          Soak report
        </button>
      </div>
      ${this._soak ? D`<rv-live-soak
            class="soak"
            closable
            .hass=${this.hass}
            @rv-live-soak-close=${() => {
			this._soak = !1;
		}}
          ></rv-live-soak>` : k}
      ${e.error ? D`<div class="banner error" role="alert">
            Could not load live view: ${e.error}
            <button
              @click=${() => {
			e.reload();
		}}
            >
              Retry
            </button>
          </div>` : k}
      ${t === void 0 ? e.error ? k : D`<p class="muted">Loading…</p>` : t.length === 0 ? D`<p class="muted">No camera can be watched live.</p>` : D`<div
              class="grid"
              @rv-live-open=${(e) => {
			F(this, {
				view: "device",
				id: e.detail.cameraId,
				tab: "live"
			});
		}}
              @rv-live-full=${(e) => {
			e.detail.full ? this._full = e.detail.cameraId : this._full === e.detail.cameraId && (this._full = void 0);
		}}
              @rv-live-count=${(e) => {
			B.count(e.detail.camera, e.detail.kind);
		}}
            >
              ${t.map((t) => D`<rv-live-tile
                    .hass=${this.hass}
                    .camera=${t}
                    .connection=${R(t)}
                    .image=${e.images[t.id]}
                    .iceServers=${e.iceServers}
                    .warm=${Rt(this.hass, t)}
                    .suspended=${this._full !== void 0 && this._full !== t.id}
                    .controls=${t.controls}
                    openable
                  ></rv-live-tile>`)}
            </div>`}`;
	}
	static styles = [P, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .header h2 {
        margin: 0;
      }
      .back {
        padding-left: 0;
        color: var(--primary-color);
      }
      .soak-button {
        margin-left: auto;
        color: var(--primary-color);
      }
      .grid {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
      }
    `];
}, Or = class extends M {
	static properties = {
		hass: { attribute: !1 },
		deviceId: { attribute: !1 },
		_error: { state: !0 }
	};
	_data = new Lt(this);
	willUpdate() {
		this._data.hass = this.hass;
	}
	render() {
		let e = this._data;
		if (e.error) return D`<div class="banner error" role="alert">
        Could not load live view: ${e.error}
        <button
          @click=${() => {
			e.reload();
		}}
        >
          Retry
        </button>
      </div>`;
		if (!e.cameras) return D`<p class="muted">Loading…</p>`;
		let t = zt(e.cameras, this.deviceId);
		return t ? D`<rv-live-tile
        .hass=${this.hass}
        .camera=${t}
        .connection=${R(t)}
        .image=${e.images[t.id]}
        .iceServers=${e.iceServers}
        .warm=${Rt(this.hass, t)}
        .controls=${t.controls}
      ></rv-live-tile>
      ${this._renderKeepWarm(t)}` : D`<p class="muted">This camera cannot be watched live.</p>`;
	}
	_renderKeepWarm(e) {
		let t = e.keep_warm_entity;
		if (!t) return k;
		let n = this.hass?.states[t]?.state;
		return D`<label class="keep-warm">
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
    ${this._error ? D`<div class="banner error" role="alert">Could not change it: ${this._error}</div>` : k}`;
	}
	static styles = [P, o`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 1280px;
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
customElements.get("rv-live-grid") || customElements.define("rv-live-grid", Dr), customElements.get("rv-live-camera") || customElements.define("rv-live-camera", Or);
//#endregion
//#region src/catalog.ts
var kr = {
	id: "other",
	title: "Other",
	description: "Entities this version of Reolink Viewer does not know yet."
};
function Ar(e, t, n) {
	if (e && n !== null) return e.entities[t]?.[n];
}
function jr(e, t) {
	let n = t.indexOf(".");
	if (!(n < 0)) return Ar(e, t.slice(0, n), t.slice(n + 1));
}
function Mr(e) {
	return [...e?.categories ?? [], kr];
}
function Nr(e, t) {
	if (e?.impact !== "disruptive") return null;
	let n = e.disruptive_when ?? "any", r;
	return r = Array.isArray(n) ? typeof t == "object" && n.includes(t.option) : n === "any" || t === n, r ? e.impact_note ?? "This action can disrupt the camera." : null;
}
function Pr(e, t) {
	return e.name ?? t?.title ?? e.entity_id;
}
var Fr = (e) => e.toLowerCase();
function Ir(e, t, n) {
	let r = Fr(n).split(/\s+/).filter(Boolean);
	if (!r.length) return !0;
	let i = Fr([
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
function Lr(e, t) {
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
function Rr(e) {
	return {
		domain: "light",
		service: "turn_on",
		data: { brightness_pct: e }
	};
}
//#endregion
//#region src/writes.ts
var zr = 1e4, Br = class {
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
}, Vr = 1, Hr = class extends M {
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
	writes = new Br();
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
			let e = Ar(this.catalog, n.domain, n.key);
			if (!Ir(n, e, this._search)) continue;
			let r = t.get(n.category) ?? [];
			r.push({
				entity: n,
				entry: e,
				label: Pr(n, e)
			}), t.set(n.category, r);
		}
		for (let e of t.values()) e.sort((e, t) => e.label.localeCompare(t.label));
		return t;
	}
	render() {
		let e = this.connection;
		if (!this.device || !e) return D`<p class="muted">No settings.</p>`;
		let t = this._rows(e), n = e.entities.filter((e) => e.disabled_by !== null).length, r = Mr(this.catalog).filter((e) => t.has(e.id));
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
          ${Ur(e)} (${e.entities.length})
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
		let t = e.related.map((e) => jr(this.catalog, e)?.title).filter((e) => e !== void 0);
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
			default: return D`<span class="value">${Gr(n, e.domain)}</span>`;
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
			this._write(e, t, r, "on", Rr(r));
		}}
          />` : k}
      ${this._toggle(e, t, l, i)}
    </span>`;
	}
	_number(e, t, n, r, i) {
		let a = n.attributes, o = Wr(a.min, 0), s = Wr(a.max, 100), c = Wr(a.step, 1), l = typeof a.unit_of_measurement == "string" ? a.unit_of_measurement : "", u = Number(n.state), d = typeof r == "number" ? r : u, f = Number.isFinite(d) ? String(d) : "", p = (n) => {
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
		let i = n.attributes, a = typeof i.installed_version == "string" ? i.installed_version : "?", o = typeof i.latest_version == "string" ? i.latest_version : null, s = typeof i.supported_features == "number" ? i.supported_features : 0, c = i.in_progress === !0 || r, l = n.state === "on" && (s & Vr) !== 0;
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
		let o = Nr(Ar(this.catalog, e.domain, e.key), r);
		if (o !== null && !await this.confirm(t, o)) return;
		let s = i ?? Lr(e.domain, e.domain === "button" ? "press" : e.domain === "update" ? "install" : n), c = e.entity_id, l = this.writes.begin(c, n, a.states[c]);
		this.requestUpdate();
		try {
			await a.callService(s.domain, s.service, s.data, { entity_id: c }, !1), this.writes.confirm(c, l), this._scheduleSettle();
		} catch (e) {
			this.writes.fail(c, l) && I(this, `Could not change ${t}: ${N(e).message}`, "error");
		}
		this.requestUpdate();
	}
	_scheduleSettle() {
		clearTimeout(this._settleTimer), this._settleTimer = setTimeout(() => {
			this.hass && this.writes.settle(this.hass.states) && this.requestUpdate(), this.writes.size && this._scheduleSettle();
		}, zr + 100);
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
				let r = (await ze(n, e.entity_id)).reload_delay;
				I(this, `${t} enabled. Home Assistant reloads the Reolink entry${r ? ` in about ${r} seconds` : ""}; the entity becomes available after that.`), this.dispatchEvent(new CustomEvent("rv-entity-enabled", {
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				I(this, `Could not enable ${t}: ${N(e).message}`, "error");
			} finally {
				let t = new Set(this._enabling);
				t.delete(e.entity_id), this._enabling = t;
			}
		}
	}
	static styles = [P, o`
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
function Ur(e) {
	return e.via === "nvr" ? `NVR (${e.host_name ?? e.entry_title})` : "Direct";
}
function Wr(e, t) {
	return typeof e == "number" && Number.isFinite(e) ? e : t;
}
function Gr(e, t) {
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
customElements.get("rv-settings") || customElements.define("rv-settings", Hr);
//#endregion
//#region src/components/overview.ts
var Kr = 3e4, qr = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, Jr = class extends M {
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
		}, Kr));
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
            every ${Kr / 1e3} seconds while this page is open.
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
      <h2>${mt(e?.kind ?? "nvr")}</h2>
      <p class="muted small">${e?.camera_ids.length ?? 0} cameras; open one from the list.</p>
      <button class="link" @click=${() => {
			F(this, { view: "list" });
		}}>All devices</button>
    </section>`;
	}
	_renderConnection(e, t) {
		let n = e.details, r = t.node.kind === "camera";
		return D`<section class="card">
      <div class="header">
        <h2>${r ? Ur(e) : "Device"}</h2>
        ${e.playback_source ? D`<span class="badge accent">playback source</span>` : k}
        ${e.channel !== void 0 && e.channel !== null && e.via === "nvr" ? D`<span class="badge">channel ${e.channel + 1}</span>` : k}
      </div>
      ${n === null ? D`<p class="muted">
            Details are unavailable${t.degraded ? " in degraded mode" : ""}.
          </p>` : D`
            ${n.channel ? Yr(n.channel) : k}
            ${e.via === "direct" || !r ? Xr(n.host) : k}
          `}
      <p class="muted small">
        ${e.entities.length} entities
        (${e.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [P, o`
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
function Yr(e) {
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
    <dd>${ht(e.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${ht(e.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${Zr(e.network)}</dd>
    ${e.battery ? D`<dt>Battery</dt>
          <dd>
            ${e.battery.percent ?? "?"}%${e.battery.status ? ` · ${e.battery.status}` : ""}${e.battery.temperature_c === null ? "" : ` · ${e.battery.temperature_c} °C`}${e.wired_power ? " · on wired power" : ""}
          </dd>` : k}
    <dt>Recordings</dt>
    <dd>${e.supports_replay ? "playback supported" : "no playback"}</dd>
    ${e.ai_types.length ? D`<dt>AI detection</dt>
          <dd>${e.ai_types.map((e) => qr[e] ?? e).join(", ")}</dd>` : k}
    ${e.capabilities.length ? D`<dt>Features</dt>
          <dd class="chips">${e.capabilities.map((e) => D`<span class="badge">${e}</span>`)}</dd>` : k}
  </dl>`;
}
function Xr(e) {
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
      ${Zr(e.network)} · ${t.http.https ? "HTTPS" : "HTTP"}${t.http.port ? ` port ${t.http.port}` : ""}${e.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${_t(t.rtsp.enabled)}${t.rtsp.port ? ` (${t.rtsp.port})` : ""} · RTMP
      ${_t(t.rtmp.enabled)}${t.rtmp.port ? ` (${t.rtmp.port})` : ""} · ONVIF
      ${_t(t.onvif.enabled)}${t.onvif.port ? ` (${t.onvif.port})` : ""}
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
function Zr(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", Jr);
//#endregion
//#region src/playback/mse-sample.ts
var Qr = {
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
}, $r = [
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
function ei(e) {
	let t = window[e];
	return typeof t == "function" ? t : void 0;
}
function ti(e, t) {
	let n = ei(e);
	if (n) try {
		return n.isTypeSupported(`video/mp4; codecs="${t}"`);
	} catch {
		return !1;
	}
}
function ni(e) {
	for (let [t, n] of Object.entries(Qr)) if (ti(e, n.codec)) return {
		name: t,
		sample: n
	};
}
var ri = (e) => Uint8Array.from(atob(e), (e) => e.charCodeAt(0));
function ii(e, t) {
	let n = new Uint8Array(e.length + t.length);
	return n.set(e), n.set(t, e.length), n;
}
function ai(e, t) {
	return new Promise((n, r) => {
		let i = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), n();
		}, a = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), r(/* @__PURE__ */ Error("append error"));
		};
		e.addEventListener("updateend", i), e.addEventListener("error", a), e.appendBuffer(t);
	});
}
async function oi(e, t, n, r = 5e3) {
	let i = ei(e);
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
						await ai(i, ri(t.init)), await ai(i, ii(ri(t[n]), ri(t.mdat)));
					} catch {
						e("append error");
						return;
					}
					if (!i.buffered.length) e("appended, nothing buffered");
					else {
						try {
							s.endOfStream();
						} catch {}
						e(await si(o, r) ? `plays (${Math.round(performance.now() - a)} ms)` : "buffered, does not play");
					}
				})();
			}, { once: !0 });
		});
		return o.src = c, await e;
	} finally {
		clearTimeout(l), o.removeAttribute("src"), o.load(), o.remove(), URL.revokeObjectURL(c);
	}
}
function si(e, t) {
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
var ci = "0.3.2", li = [
	"Desktop Chrome, LAN",
	"Desktop Chrome, Tailscale",
	"Desktop Chrome, Nabu Casa",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
];
function ui(e) {
	return !/Tailscale|Nabu Casa/.test(e);
}
var di = [
	.5,
	1,
	2,
	4,
	8
], fi = 6e3, pi = 1e3, mi = 6e4, hi = 3e3, gi = 1e4, _i = [
	-10,
	-5,
	3,
	8,
	15
], vi = 6e5, yi = 3e5, bi = 15, xi = 7, K = "reolink-viewer-check-running", Si = class extends Error {}, Ci = (e) => new Promise((t) => setTimeout(t, e)), wi = (e) => e.time;
function Ti(e, t, n) {
	return new Promise((r) => {
		let i = setTimeout(() => {
			e.removeEventListener(t, a), r(!1);
		}, n), a = () => {
			clearTimeout(i), r(!0);
		};
		e.addEventListener(t, a, { once: !0 });
	});
}
var q = (e) => new Date(e).toLocaleTimeString(), Ei = class {
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
		this.running = !0, Bi(this.id, this.options.setup);
		try {
			await this._header(), await this._timelines(), await this._events(), await this._deep(), await this._advance(), await this._rates(), await this._scrub(), await this._switchHd(), await this._link(), await this._capabilities(), this.options.soakMinutes > 0 && await this._soak(), this._log("Summary:");
			for (let e of this._summary) this._log(`- ${e}`);
		} catch (e) {
			this._log(e instanceof Si ? "Stopped." : `Check failed: ${N(e).message}`);
		} finally {
			this._t.player?.pause(), this.running = !1, this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0), Vi(this.id);
		}
		return this.text;
	}
	_log(e) {
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > gi && this._save(!1);
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
		if (this._stopped) throw new Si();
	}
	async _wait(e, t) {
		let n = performance.now() + t;
		for (; performance.now() < n;) {
			if (this._checkStopped(), e()) return !0;
			await Ci(100);
		}
		return e();
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await Ci(Math.min(250, t - performance.now()));
	}
	async _header() {
		let e = this._t, t = navigator.connection;
		this._log(`Reolink Viewer playback check v${ci} · ${this.options.setup} · ${e.cameraName} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${Xt(navigator.userAgent)} · page ${Kt(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x` + (t?.effectiveType ? ` · network ${t.effectiveType}, ${t.downlink ?? "?"} Mbit/s (browser estimate)` : ""));
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
		this._log(`A1 Time to timeline, today (as the tab opened): ${V(n.timelineMs)} (server: ${zi(n.timelineServer)})`);
		let r = Number(t.slice(8, 10)), i = [...e.monthDays].filter((e) => e < r).sort((e, t) => t - e), a = i.at(Math.min(2, i.length - 1));
		if (a === void 0) {
			this._log("A2/A3 skipped: no earlier recording day this month"), this._summary.push(`Timeline: today ${W(n.timelineMs, 1e3)}`);
			return;
		}
		let o = `${t.slice(0, 8)}${String(a).padStart(2, "0")}`, s = await this._loadDay(o);
		this._log(`A2 Time to timeline, ${o}: ${V(s.timelineMs)} (server: ${zi(s.timelineServer)})`), await this._loadDay(t);
		let c = await this._loadDay(o);
		this._log(`A3 Time to timeline, ${o} again: ${V(c.timelineMs)} (server: ${zi(c.timelineServer)})`);
		let l = await this._loadDay(t);
		this._log(`A4 Time to timeline, today again: ${V(l.timelineMs)} (server: ${zi(l.timelineServer)})`);
		let u = s.timelineServer?.cache === "fresh";
		this._summary.push(`Timeline: today ${W(n.timelineMs, 1e3)}, past day first ${W(s.timelineMs, u ? 3e3 : 1e3)} (${u ? "cold, < 3 s" : "cached, < 1 s"}), again ${W(c.timelineMs, 1e3)}`);
	}
	async _play(e) {
		let t = this._t;
		performance.clearResourceTimings(), performance.setResourceTimingBufferSize(1e3);
		let n = performance.now(), r = Ii(t.player, n), i = t.playing;
		await t.playAt(e, n);
		let a = t.playing === i ? void 0 : t.playing?.cache, o = await this._wait(() => t.metrics.firstFrameMs !== void 0 || !!t.playFailure, 12e4);
		r.stop();
		let s = t.metrics, c = t.player?.time, l = c === void 0 ? void 0 : c - e, u = l === void 0 || Math.abs(l) <= 2e3 ? "" : ` · STARTED AT ${q(c ?? 0)}, ${U(Math.abs(l))} ${l < 0 ? "before" : "after"} the time asked`, d = t.playing?.file ? ` · ${t.playing.file} file` : "", f = `first frame ${o && !t.playFailure ? V(s.firstFrameMs) : "none"} [URL ${V(s.urlMs)} · metadata ${V(r.seen.loadedmetadata)} · seeked ${V(r.seen.seeked)} · playing ${V(r.seen.playing)}] ${s.delivery ?? "?"}${d} · ${s.stream ?? "?"} ${s.codec ?? ""}${u}${t.playFailure ? ` FAILED: ${t.playFailure}` : ""}`;
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
			this._log("B  skipped: no events today");
			return;
		}
		let r = [];
		for (let i of n) {
			let n = t.segments.find((e) => i.start >= e.start && i.start < e.end), a = n ? `${U(i.start - n.start)} into a ${U(n.end - n.start)} recording` : "no recording", o = await this._play(i.start);
			o.ok && e.metrics.firstFrameMs !== void 0 && r.push(`${W(e.metrics.firstFrameMs, 2e3)}${o.held?.complete === !1 ? " (not cached)" : ""}`), this._log(`B  ${i.types.join("+")} at ${q(i.start)} (${a}): ${o.line}`), await Ci(300), this._log(`     ${Li(o.began, o.source)}`), n && this._log(`     ${await this._fillReport()}`), await this._pause(1500);
		}
		this._summary.push(`Events → first frame (sub): ${r.join(", ") || "none played"}`);
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
		let e = this._t.playing, t = Ke(e?.base ?? e?.url ?? "");
		if (!t) return "server: nothing played";
		let n = e?.file === "plain", r = null;
		for (let e = 0; e < 90; e += 1) {
			try {
				r = (await Je(this._t.hass, t)).cache;
			} catch {
				r = null;
			}
			if (!r || r.error || r.complete && (!n || r.flat !== void 0)) break;
			await this._pause(1e3);
		}
		if (!r) return "server: not cached (or its URL expired)";
		let i = [r.cache === "disk" ? "from disk" : `fill (${ki(r.priority)})`];
		for (let [e, t] of [
			["wait_ms", "queue"],
			["headers_ms", "NVR headers"],
			["ttfb_ms", "NVR first byte"],
			["fill_ms", "download"]
		]) typeof r[e] == "number" && i.push(`${t} ${V(r[e])}`);
		return typeof r.mbit_s == "number" && i.push(`${r.mbit_s} Mbit/s`), i.push(H(r.bytes)), r.indexed !== void 0 && i.push(`index ${ki(r.indexed)}`), (n || r.flat !== void 0) && i.push(`plain MP4 ${r.flat === void 0 ? "not yet" : ki(r.flat)}`), typeof r.flat_ms == "number" && i.push(`rewrite ${V(r.flat_ms)}`), typeof r.flat_moov_bytes == "number" && i.push(`moov ${H(r.flat_moov_bytes)}`), r.error && i.push(`error ${r.error}`), `server: ${i.join(", ")}`;
	}
	async _findLong() {
		let e = this._t, t = e.today, n = Number(t.slice(8, 10)), r = [t, ...[...e.monthDays].filter((e) => e < n).sort((e, t) => t - e).slice(0, xi).map((e) => `${t.slice(0, 8)}${String(e).padStart(2, "0")}`)], i = 0, a;
		for (let t of r) {
			let n;
			try {
				n = t === e.date && e.day ? e.day : await He(e.hass, e.deviceId, t);
			} catch {
				continue;
			}
			for (let e of Qt(n.segments, n.now)) {
				if (i >= bi) return a;
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
		let n = t.segment, r = U(n.end - n.start), i = (e) => `${U(e.time - n.start)} into a ${r} recording of ${t.date}` + (e.event ? ` (event ${e.event.types.join("+")} at ${q(e.event.start)})` : " (no event there: a point)"), a;
		if (t.cached) this._log("D1 skipped: every long recording looked at is cached already (try again after other recordings were viewed)");
		else {
			let r = Zt(n, t.day.events, .5, .95, .75), o = await this._play(r.time), s = o.held;
			o.ok && s?.complete === !1 && (a = e.metrics.firstFrameMs);
			let c = s?.complete ? "Not cached when chosen, but on disk when played (not counted)" : s?.bytes ? `Not cached (${H(s.bytes)} already fetched when played)` : "Not cached";
			this._log(`D1 ${c}, ${i(r)}: ${o.line}`), await Ci(300), this._log(`     ${Li(o.began, o.source)}`), this._log(`     ${await this._fillReport()}`);
		}
		await this._pause(1500);
		let o = Zt(n, t.day.events, .1, .45, .4), s = await this._play(o.time), c = s.held?.complete === !1, l = s.ok && !c ? e.metrics.firstFrameMs : void 0;
		this._log(`D2 ${c ? "Cached when chosen, but not on disk when played (not counted)" : "Cached"}, ${i(o)}: ${s.line}`), await Ci(300), this._log(`     ${Li(s.began, s.source)}`), this._summary.push(`Deep start (sub, ${r} recording): not cached ${a === void 0 ? "not measured" : V(a)}, cached ${W(l, 2e3)}`);
	}
	async _advance() {
		let e = this._t, t = $t(e.day?.segments ?? []);
		!t.length && e.date !== e.today && (await this._loadDay(e.today), t = $t(e.day?.segments ?? []));
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
			r = t ? o.includes("advanced") ? `yes (preloaded) · gap ${V(e.metrics.gapMs)}` : `yes, by reloading (the next file was not preloaded) · first frame ${V(e.metrics.firstFrameMs)}` : `no: on ${n?.current?.segmentId === i.id ? "the first" : n?.current ? "another" : "no"} recording at ${n?.time === void 0 ? "?" : q(n.time)}, ${n?.paused ? "paused" : "playing"}, next ${n?.preloaded ? "preloaded" : "not preloaded"}, events [${o.join(", ")}]`, this._log(`C  Moved on by itself at ${q(i.end)} (from a ${U(i.end - i.start)} recording): ${r}` + (e.playFailure ? ` FAILED: ${e.playFailure}` : "")), this._summary.push(`Auto-advance: ${t && o.includes("advanced") ? `gap ${V(e.metrics.gapMs)}` : r}`);
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
		this._log(`R  Playback rates, ${U(r.end - r.start)} recording, ${fi / 1e3} s each (sub stream):`);
		let a = [];
		try {
			for (let t of di) {
				let n = Pi(e.player);
				if (!n) break;
				let r = await this._measureRate(n, t);
				if (a.push(r), this._log(`     ${tn(r)}`), r.ended) break;
			}
		} finally {
			let t = Pi(e.player);
			t && (t.playbackRate = 1);
		}
		this._summary.push(`Rates: ${a.map((e) => `${e.rate}× ${an(e) ? "✓" : "✗"}`).join(" ") || "not measured"} (smooth = ${nn})`);
	}
	async _scrub() {
		let e = this._t.player, t = e?.current, n = Pi(e);
		if (!e || !t || !n || e.time === void 0) {
			this._log("S  skipped: nothing playing");
			return;
		}
		await this._pause(3e3);
		let r = wi(e) ?? t.start, i = [], a = [], o = 0;
		for (let s of _i) {
			let c = r + s * 1e3;
			if (c < t.start || c > t.end) continue;
			let l = performance.now(), u = Ti(n, "seeked", 3e3);
			e.preview(c) ? await u && (i.push(performance.now() - l), o = Math.max(o, Math.abs((wi(e) ?? c) - c))) : a.push(s);
		}
		let s = r + vi, c = s < t.end ? ` · ${U(vi)} ahead: ${e.preview(s) ? "buffered, shown" : "not buffered (the thumbnail shows instead)"}` : "", l = i.length + a.length, u = i.length ? [...i].sort((e, t) => e - t)[Math.floor(i.length / 2)] : void 0;
		this._log(`S  Scrub preview (frames from the buffer while dragging): ${i.length} of ${l} points shown` + (u === void 0 ? "" : `, median ${V(u)}, each within ${(o / 1e3).toFixed(2)} s of its point`) + (a.length ? ` · not buffered: ${a.map((e) => `${e > 0 ? "+" : ""}${e} s`).join(", ")}` : "") + c), this._summary.push(`Scrub: ${i.length} of ${l} points in the buffer shown${u === void 0 ? "" : ` (median ${V(u)})`}`), e.resume();
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
		let r = e.day?.segments.find((e) => e.id === n.segmentId), i = r ? ` (${U((t.time ?? r.start) - r.start)} into a ${U(r.end - r.start)} recording)` : "", a = await this._switchTo("main");
		if (!a.ok) {
			this._log(`H  HD at ${q(a.at)}${i}: ${a.line}`), this._summary.push(`HD switch: ${a.line}`);
			return;
		}
		this._hdPlayed = !0, this._log(`H  HD at ${q(a.at)}${i}: ${a.line} · ${e.metrics.stream ?? "?"} ${e.metrics.codec ?? "?"} · ${e.metrics.delivery ?? "?"}`), this._log(`     ${await this._fillReport()}`), await this._pause(5e3);
		let o = await this._switchTo("sub");
		this._log(`     Back to SD at ${q(o.at)}: ${o.line}`), this._summary.push(`HD switch: to HD ${a.short}; back to SD ${o.short}`);
	}
	async _switchTo(e) {
		let t = this._t, n = t.player, r = n?.time ?? 0, i = t.metrics.hdFailures ?? 0, a = () => (t.metrics.hdFailures ?? 0) > i;
		t.setStream(e);
		let o = await this._wait(() => t.metrics.stream === e && t.metrics.firstFrameMs !== void 0 || a() || !!t.playFailure, yi), s = a() ? t.metrics.lastHdFailure ?? "HD failed" : t.playFailure;
		if (!o || s) {
			let e = s ? `FAILED: ${s} (back on the sub stream)` : `no first frame within ${U(yi)}`;
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
			line: `first frame ${V(c)}, started ${l.toFixed(2)} s from where ${e === "main" ? "SD" : "HD"} was (${u})`,
			short: `${V(c)}, ${u} (${l.toFixed(2)} s)`
		};
	}
	async _measureRate(e, t) {
		e.playbackRate = t;
		let n = e.playbackRate;
		await this._pause(pi);
		let r = Oi(), i = setInterval(() => {
			r &&= Oi();
		}, 250), a = Mi(e), o = e.currentTime, s = performance.now(), c = 0, l, u = 0, d = !1, f = () => {
			c += 1, l ??= performance.now();
		}, p = () => {
			l !== void 0 && (u += performance.now() - l), l = void 0;
		}, m = () => {
			d = !0;
		};
		e.addEventListener("waiting", f), e.addEventListener("playing", p), e.addEventListener("ended", m);
		let h = Fi(e);
		try {
			await this._pause(fi);
		} finally {
			clearInterval(i), h.stop(), e.removeEventListener("waiting", f), e.removeEventListener("playing", p), e.removeEventListener("ended", m);
		}
		l !== void 0 && (u += performance.now() - l);
		let g = Mi(e);
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
			focused: r && Oi()
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
		}, hi);
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
			this._log(`L  Link to Home Assistant: ${H(a)} of the cached recording in ${V(s - i)} after the answer = ${c.toFixed(1)} Mbit/s (answer ${V(i)}, HTTP ${r.status})`), this._summary.push(`Link: ${c.toFixed(1)} Mbit/s`);
		} catch (e) {
			this._log(`L  Link test failed: ${N(e).message}`);
		} finally {
			clearTimeout(r);
		}
	}
	async _capabilities() {
		let e = this._t, t = {};
		try {
			t = await Ze(e.hass, e.deviceId);
		} catch {}
		let n = t.sub?.codec, r = t.main?.codec, i = (e) => [["sub", n], ["main", r]].map(([t, n]) => n ? `${t} ${n} ${Di(ti(e, n))}` : `${t} codec unknown (not cached yet)`).join(", "), a = ["MediaSource", "ManagedMediaSource"];
		this._log(`MSE: ${a.map((e) => ei(e) ? `${e} present (${i(e)})` : `${e} absent`).join(" · ")}`);
		let o = [];
		for (let e of a) {
			if (!ei(e)) continue;
			let t = ni(e);
			if (!t) {
				this._log(`MSE probe (${e}): no sample codec supported`);
				continue;
			}
			let n = [];
			for (let { shape: r, label: i } of $r) this._checkStopped(), n.push(`${i} ${await oi(e, t.sample, r)}`);
			this._log(`MSE probe (${e}, ${t.name} sample): ${n.join(" · ")}`), o.push(`${e} ${n[0]?.includes("plays") ? "plays MSE-ready fragments" : "fails"}`);
		}
		this._summary.push(`MSE: ${o.join(", ") || "neither MediaSource nor ManagedMediaSource"}`);
		let s = document.createElement("video"), c = (e) => e ? `"${s.canPlayType(`video/mp4; codecs="${e}"`)}"` : "unknown";
		this._log(`Video: canPlayType sub ${c(n)}, main ${c(r)} · getVideoPlaybackQuality ${Di("getVideoPlaybackQuality" in s)} · requestVideoFrameCallback ${Di("requestVideoFrameCallback" in s)} · performance.memory ${Di(Ai() !== void 0)}`), this._log(`HD as the tab opened: ${e.hd.reason}${this._hdPlayed ? " (played in H above)" : ""}`), t.main?.width && t.main.height && r && this._log(`HD decodingInfo for ${r} at ${t.main.width}×${t.main.height}: ${await Ri(r, t.main.width, t.main.height)}`), this._hdPlayed || this._summary.push(`HD: ${e.hd.main ? "offered" : "not offered"} (${e.hd.reason})`);
	}
	async _soak() {
		let e = this._t, t = this.options.soakMinutes, n = this._long, r = n?.date ?? e.date;
		e.date !== r && await this._loadDay(r);
		let i = n?.segment ?? e.day?.segments[0];
		if (!i) {
			this._log("M  skipped: no recording to play");
			return;
		}
		this._log(`M  One-hour session: playing from ${q(i.start)} on ${r} for ${t} min, a sample a minute`);
		let a = e.player, o = 0, s = 0, c = [], l = () => {
			o += 1;
		}, u = (e) => {
			s += 1, c.push(e.detail.gapMs);
		}, d = [...a?.renderRoot.querySelectorAll("video") ?? []], f = [], p = [], m = 0, h = new ji(), g = { minute: !0 }, ee = setInterval(() => {
			g.minute &&= Oi();
		}, 1e3), _ = performance.now();
		try {
			await this._play(i.start), d.forEach((e) => {
				e.addEventListener("waiting", l);
			}), a?.addEventListener("rv-advanced", u);
			for (let n = 1; n <= t; n += 1) {
				if (await this._pause(mi), e.player?.paused && document.visibilityState === "visible") {
					let t = e.day?.segments[0];
					this._log(`M  ${n} min: playback had stopped${e.playFailure ? ` (${e.playFailure})` : ""}; starting again from the day's first recording`), t && await e.playAt(t.start, performance.now());
				}
				let t = Pi(e.player), r = h.update(d), i = g.minute && Oi();
				g.minute = !0;
				let a = t ? Math.max(0, Ni(t) - t.currentTime) : 0;
				m = Math.max(m, a);
				let c = Ai();
				c !== void 0 && f.push([(performance.now() - _) / 36e5, c]);
				let l = await this._stats();
				l?.vod.disk_bytes !== void 0 && p.push(l.vod.disk_bytes);
				let u = d.reduce((e, t) => e + sn(t.buffered), 0);
				this._log(`M  ${n} min: ${e.player?.time === void 0 ? "?" : q(e.player.time)} ${e.player?.paused ? "paused" : "playing"}` + (document.visibilityState === "visible" ? "" : " (page hidden: the system pauses video)") + (i ? "" : " · PAGE NOT IN FRONT this minute") + ` · heap ${c === void 0 ? "n/a" : H(c)} · ${a.toFixed(0)} s ahead, ${u.toFixed(0)} s buffered in both videos · dropped ${r} this minute, ${h.dropped} of ${h.decoded} in all · ${o} stalls · ${s} file changes` + (e.metrics.recoveries ? ` · ${e.metrics.recoveries} reloads mid-way` : "") + (l ? ` · cache ${H(l.vod.disk_bytes)} on disk + ${H(l.vod.reserved_bytes)} reserved, ${l.vod.leased ?? "?"} leased` : "")), Bi(this.id, this.options.setup, n);
			}
		} finally {
			clearInterval(ee), d.forEach((e) => {
				e.removeEventListener("waiting", l);
			}), a?.removeEventListener("rv-advanced", u);
		}
		let v = on(f), y = f.length ? `heap ${H(f[0]?.[1])} → ${H(f.at(-1)?.[1])} (max ${H(Math.max(...f.map(([, e]) => e)))}${v === void 0 ? "" : `, ${v >= 0 ? "+" : ""}${H(v)}/h`})` : "heap not measurable in this browser (the page was not reloaded)", te = (await this._stats())?.vod.max_bytes, b = p.length ? `cache ${H(Math.min(...p))}–${H(Math.max(...p))} on disk (cap ${H(te)})` : "cache use unknown", x = `${t} min: ${y}, at most ${m.toFixed(0)} s buffered ahead, ${h.dropped} of ${h.decoded} frames dropped, ${o} stalls, ${s} file changes${c.length ? ` (gaps ${c.map((e) => V(e)).join(", ")})` : ""}, ${e.metrics.recoveries ?? 0} reloads mid-way, ${b}`;
		this._log(`M  Summary: ${x}`), this._summary.push(`Session: ${x}`);
	}
	async _stats() {
		try {
			return await this._t.hass.callWS({ type: "reolink_viewer/playback/stats" });
		} catch {
			return;
		}
	}
}, Di = (e) => e === void 0 ? "n/a" : e ? "yes" : "no", Oi = () => document.visibilityState === "visible" && document.hasFocus(), ki = (e) => typeof e == "string" || typeof e == "number" ? String(e) : "?";
function Ai() {
	return performance.memory?.usedJSHeapSize;
}
var ji = class {
	decoded = 0;
	dropped = 0;
	_last = /* @__PURE__ */ new Map();
	update(e) {
		let t = this.dropped;
		for (let t of e) {
			let e = Mi(t);
			if (!e) continue;
			let n = this._last.get(t), r = !n || e.totalVideoFrames < n.totalVideoFrames;
			this.decoded += r ? e.totalVideoFrames : e.totalVideoFrames - n.totalVideoFrames, this.dropped += r ? e.droppedVideoFrames : e.droppedVideoFrames - n.droppedVideoFrames, this._last.set(t, e);
		}
		return this.dropped - t;
	}
};
function Mi(e) {
	return typeof e.getVideoPlaybackQuality == "function" ? e.getVideoPlaybackQuality() : void 0;
}
function Ni(e) {
	let t = e.buffered;
	for (let n = 0; n < t.length; n += 1) if (t.start(n) <= e.currentTime + .5 && t.end(n) >= e.currentTime) return t.end(n);
	return e.currentTime;
}
function Pi(e) {
	return e?.renderRoot.querySelector("video.active") ?? null;
}
function Fi(e) {
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
function Ii(e, t) {
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
function Li(e, t) {
	let n = t ? new URL(t, location.href).pathname : "", r = performance.getEntriesByType("resource").filter((t) => (t.initiatorType === "video" || t.initiatorType === "fetch" && t.name.includes("/api/reolink_viewer/mse/")) && t.startTime >= e - 5);
	if (!r.length) return "requests: none reported (this browser may not report video requests)";
	let i = r.filter((e) => e.requestStart > 0), a = i.slice(0, 10).map((t, r) => {
		let i = n && new URL(t.name).pathname.startsWith(n) ? "" : " (other file)", a = t.encodedBodySize ? ` · ${H(t.encodedBodySize)}` : "";
		return `#${r + 1}${i} +${Math.round(t.startTime - e)} ms: wait ${Math.round(t.requestStart - t.startTime)} · answer ${Math.round(t.responseStart - t.requestStart)} · ran ${Math.round(t.responseEnd - t.responseStart)} ms${a}`;
	}), o = i.length > 10 ? ` | … ${i.length - 10} more` : "", s = r.length - i.length, c = [...new Set(i.map((e) => e.nextHopProtocol).filter(Boolean))].join("/");
	return `requests${c ? ` (${c})` : ""}: ${i.length} sent${s ? `, ${s} cancelled before sending` : ""}: ${a.join(" | ")}${o}`;
}
async function Ri(e, t, n) {
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
function zi(e) {
	if (!e) return "?";
	let t = [e.cache ?? "?"];
	e.age_s !== void 0 && t.push(`${ki(e.age_s)} s old`);
	for (let [n, r] of [
		["queue_ms", "queue"],
		["files_ms", "recordings"],
		["events_ms", "events"],
		["total_ms", "total"]
	]) {
		let i = e[n];
		typeof i == "number" && t.push(`${r} ${V(i)}`);
	}
	return typeof e.warm == "string" && t.push(`background fetch: ${e.warm}`), t.join(", ");
}
function J() {
	try {
		return window.localStorage;
	} catch {
		return;
	}
}
function Bi(e, t, n) {
	try {
		let r = J()?.getItem(K), i = {
			id: e,
			setup: t,
			started: r ? JSON.parse(r).started : (/* @__PURE__ */ new Date()).toISOString(),
			updated: (/* @__PURE__ */ new Date()).toISOString(),
			...n ? { minute: n } : {}
		};
		J()?.setItem(K, JSON.stringify(i));
	} catch {}
}
function Vi(e) {
	try {
		let t = J()?.getItem(K);
		t && JSON.parse(t).id === e && J()?.removeItem(K);
	} catch {}
}
async function Hi(e) {
	let t;
	try {
		let e = J()?.getItem(K);
		if (!e) return;
		t = JSON.parse(e), J()?.removeItem(K);
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
var Ui = (e) => e.callWS({ type: "reolink_viewer/playback/check_reports" }), Y = 6e4, X = 60 * Y, Wi = 24 * X, Z = [
	Wi,
	6 * X,
	X,
	15 * Y,
	5 * Y
];
function Gi(e, t, n) {
	return (e - t.start) / t.span * n;
}
function Ki(e, t, n) {
	return t.start + e / n * t.span;
}
function qi(e, t) {
	let n = t.end - t.start, r = Z[Z.length - 1] ?? 6e4, i = Math.min(Math.max(e.span, r), Math.max(n, r));
	return i >= n ? {
		start: t.start,
		span: n
	} : {
		start: Math.min(Math.max(e.start, t.start), t.end - i),
		span: i
	};
}
function Ji(e, t, n, r) {
	return qi({
		start: n - (n - e.start) / e.span * t,
		span: t
	}, r);
}
function Yi(e) {
	let t = 0;
	return Z.forEach((n, r) => {
		Math.abs(n - e) < Math.abs((Z[t] ?? n) - e) && (t = r);
	}), t;
}
function Xi(e, t, n) {
	return qi({
		start: t - e.span / 2,
		span: e.span
	}, n);
}
var Zi = [
	1e4,
	3e4,
	Y,
	5 * Y,
	10 * Y,
	15 * Y,
	30 * Y,
	X,
	2 * X,
	3 * X,
	6 * X
];
function Qi(e, t, n = 60) {
	for (let r of Zi) if (r / e.span * t >= n) return r;
	return Zi[Zi.length - 1] ?? 36e5;
}
function $i(e, t, n) {
	let r = Qi(e, t), i = [], a = e.start + e.span, o = n(e.start), s = Math.ceil((e.start + o) / r) * r - o;
	for (let e = 0; s <= a && e < 500; e += 1) i.push(s), s += r;
	return i;
}
function ea(e, t, n, r = 1) {
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
function ta(e, t) {
	let n = 0, r = e.length - 1, i;
	for (; n <= r;) {
		let a = n + r >> 1, o = e.at(a);
		if (!o) break;
		o.start <= t ? (t < o.end && (i = o), n = a + 1) : r = a - 1;
	}
	return i;
}
function na(e, t) {
	return e.find((e) => e.start > t);
}
function ra(e, t) {
	let n = ta(e, t);
	if (n) return {
		segment: n,
		offset: t - n.start
	};
	let r = na(e, t);
	return r ? {
		segment: r,
		offset: 0
	} : void 0;
}
function ia(e, t) {
	return t.size === 0 ? e : e.filter((e) => e.types.some((e) => !t.has(e)));
}
function aa(e, t) {
	return e.find((e) => e.start > t + 500);
}
function oa(e, t) {
	let n;
	for (let r of e) if (r.start < t - 1500) n = r;
	else break;
	return n;
}
var sa = [
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
], Q = new Map(sa.map((e, t) => [e.type, t]));
function ca(e) {
	let t;
	for (let n of e) (t === void 0 || (Q.get(n) ?? 99) < (Q.get(t) ?? 99)) && (t = n);
	return t ?? "MOTION";
}
function la(e) {
	return sa[Q.get(e) ?? -1]?.color ?? "#9e9e9e";
}
function ua(e) {
	return sa[Q.get(e) ?? -1]?.label ?? e.toLowerCase();
}
function da(e) {
	return [...new Set(e.flatMap((e) => e.types))].sort((e, t) => (Q.get(e) ?? 99) - (Q.get(t) ?? 99));
}
function fa(e) {
	return e >= 216e5 ? 300 : e >= 36e5 ? 60 : e >= 9e5 ? 10 : 5;
}
function pa(e, t, n) {
	let r = new Date(Date.UTC(e, t - 1, 1)).getUTCDay(), i = new Date(Date.UTC(e, t, 0)).getUTCDate(), a = (r - n % 7 + 7) % 7, o = [...Array.from({ length: a }, () => null), ...Array.from({ length: i }, (e, t) => t + 1)];
	for (; o.length % 7;) o.push(null);
	let s = [];
	for (let e = 0; e < o.length; e += 7) s.push(o.slice(e, e + 7));
	return s;
}
function ma(e, t, n) {
	let r = e * 12 + (t - 1) + n;
	return [Math.floor(r / 12), r % 12 + 1];
}
function ha(e, t, n) {
	return `${String(e).padStart(4, "0")}-${String(t).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
//#endregion
//#region src/playback/calendar.ts
var ga = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], _a = class extends M {
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
		let [t, n] = ma(this.year, this.month, e);
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
		}), t = ga.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "narrow",
			timeZone: "UTC"
		})), [n, r] = ma(this.year, this.month, 1), i = this.today !== void 0 && ha(n, r, 1) > this.today;
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
        ${pa(this.year, this.month, this.firstDay).flat().map((e) => {
			if (e === null) return D`<span></span>`;
			let t = ha(this.year, this.month, e), n = this.today !== void 0 && t > this.today, r = this.days.has(e);
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
	static styles = [P, o`
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
customElements.get("rv-calendar") || customElements.define("rv-calendar", _a);
//#endregion
//#region src/playback/time.ts
var va = /* @__PURE__ */ new Map();
function ya(e, t) {
	let n = `${e ?? ""}|${JSON.stringify(t)}`, r = va.get(n);
	if (!r) {
		try {
			r = new Intl.DateTimeFormat(void 0, {
				...t,
				...e ? { timeZone: e } : {}
			});
		} catch {
			r = new Intl.DateTimeFormat(void 0, t);
		}
		va.set(n, r);
	}
	return r;
}
function $(e, t, n = !1) {
	return ya(t, {
		hour: "2-digit",
		minute: "2-digit",
		...n ? { second: "2-digit" } : {},
		hourCycle: "h23"
	}).format(e);
}
function ba(e, t) {
	return ya(t, {
		weekday: "short",
		month: "short",
		day: "numeric"
	}).format(e);
}
function xa(e) {
	let t = Math.max(0, Math.round(e / 1e3)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = t % 60;
	return n ? `${n} h ${String(r).padStart(2, "0")} min` : r ? `${r} min ${String(i).padStart(2, "0")} s` : `${i} s`;
}
function Sa(e, t) {
	let n = ya(t, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).formatToParts(e), r = (e) => n.find((t) => t.type === e)?.value ?? "";
	return `${r("year")}-${r("month")}-${r("day")}`;
}
function Ca(e, t) {
	let n = ya(t, {
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
function wa(e) {
	try {
		let t = new Intl.Locale(e ?? navigator.language), n = t.getWeekInfo?.() ?? t.weekInfo;
		if (n) return n.firstDay % 7;
	} catch {}
	return +!/^en-(US|CA)|^ja|^he/.test(e ?? navigator.language);
}
var Ta = class extends M {
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
		let t = ca(e.types), n = this.thumbs.get(e.start);
		return D`<li>
      <button
        class="card ${this.current !== void 0 && this.current >= e.start && this.current < e.end ? "active" : ""}"
        aria-label="${e.types.map(ua).join(", ")} at ${$(e.start, this.timeZone, !0)}"
        @click=${() => {
			this.dispatchEvent(new CustomEvent("rv-pick", {
				detail: { event: e },
				bubbles: !0,
				composed: !0
			}));
		}}
      >
        <span class="thumb" style="border-color: ${la(t)}">
          ${n ? D`<img src=${n} alt="" loading="lazy" decoding="async" />` : k}
        </span>
        <span class="meta">
          <span class="types">
            ${e.types.map((e) => D`<span class="badge" style="background: ${la(e)}; color: white">${ua(e)}</span>`)}
          </span>
          <span class="when">
            ${$(e.start, this.timeZone, !0)}
            <span class="muted">· ${xa(e.end - e.start)}</span>
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
	static styles = [P, o`
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
customElements.get("rv-event-list") || customElements.define("rv-event-list", Ta);
//#endregion
//#region src/playback/player.ts
var Ea = [
	.5,
	1,
	2,
	4,
	8
], Da = class extends M {
	static properties = {
		muted: { type: Boolean },
		rate: { type: Number },
		note: { attribute: !1 },
		_active: { state: !0 },
		_paused: { state: !0 },
		_waiting: { state: !0 }
	};
	_items = [void 0, void 0];
	_keys = [void 0, void 0];
	_feeders = [void 0, void 0];
	_requestedAt;
	_firstOnSeeked = !1;
	_endedAt;
	_pendingOffset = [0, 0];
	constructor() {
		super(), this.muted = !0, this.rate = 1, this._active = 0, this._paused = !0, this._waiting = !1;
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
		await this.updateComplete, this._requestedAt = n, this._firstOnSeeked = !1, this._endedAt = void 0;
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
			let i = new yn(t, n.mse, (t) => {
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
		r && this._fail(n.message, r, n instanceof cn);
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
		return D`<div class="frame">
      ${this._renderVideo(0)}${this._renderVideo(1)}
      ${e ? D`<div class="note" role="status">${e}</div>` : k}
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
    .note {
      position: absolute;
      left: 50%;
      bottom: 48px;
      transform: translateX(-50%);
      max-width: calc(100% - 32px);
      padding: 6px 12px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      font-size: 13px;
      text-align: center;
      pointer-events: none;
    }
    /* The hidden buffer stays laid out (some browsers do not load hidden video). */
    video.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
};
customElements.get("rv-player") || customElements.define("rv-player", Da);
//#endregion
//#region src/playback/thumb-loader.ts
var Oa = class {
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
}, ka = 4, Aa = 76, ja = 18, Ma = 22, Na = 26, Pa = 52, Fa = 16, Ia = class extends M {
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
			span: Z[0] ?? 864e5
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
		return Ki(e, this.view, this._width || 1);
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
		let t = qi(e, this._bounds);
		(t.start !== this.view.start || t.span !== this.view.span) && this._emit("rv-view-change", { view: t });
	}
	zoom(e, t) {
		let n = Z[Math.min(Math.max(Yi(this.view.span) + e, 0), Z.length - 1)] ?? this.view.span, r = t ?? this.cursor ?? this.view.start + this.view.span / 2;
		this._setView(Ji(this.view, n, r, this._bounds));
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
		}, La(this._canvas, e.pointerId, !0));
	}
	_onPointerMove(e) {
		let t = this._x(e), n = this._drag;
		if (n && n.pointerId === e.pointerId) {
			if (Math.abs(t - n.x) > ka && (n.moved = !0), n.moved) {
				let e = this.timeAt(t);
				this._emit("rv-scrub", { time: e }), this._scheduleHover(e, t);
			}
		} else e.pointerType === "mouse" && this._scheduleHover(this.timeAt(t), t);
	}
	_onPointerUp(e) {
		let t = this._drag;
		t && t.pointerId === e.pointerId && (this._drag = void 0, La(this._canvas, e.pointerId, !1), this._emit("rv-seek", { time: this.timeAt(this._x(e)) }), e.pointerType !== "mouse" && this._endHover());
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
		e.width !== t * n && (e.width = t * n, e.height = Aa * n);
		let r = e.getContext("2d");
		if (!r) return;
		r.setTransform(n, 0, 0, n, 0, 0);
		let i = getComputedStyle(this), a = (e, t) => i.getPropertyValue(e).trim() || t, o = a("--secondary-text-color", "#727272"), s = a("--divider-color", "#e0e0e0"), c = a("--rv-recording-color", a("--primary-color", "#03a9f4"));
		r.clearRect(0, 0, t, Aa);
		let l = this.view, u = (e) => Gi(e, l, t);
		r.font = "11px sans-serif", r.textBaseline = "top", r.fillStyle = o, r.strokeStyle = s, r.lineWidth = 1;
		let d = this.timeZone, f = Qi(l, t) < Y;
		for (let e of $i(l, t, (e) => Ca(e, d))) {
			let n = Math.round(u(e)) + .5;
			r.beginPath(), r.moveTo(n, 14), r.lineTo(n, Aa), r.stroke();
			let i = $(e, d, f);
			n + 3 + r.measureText(i).width <= t && r.fillText(i, n + 3, 2);
		}
		let p = this.day;
		if (p) {
			if (p.now < p.end) {
				r.fillStyle = a("--secondary-background-color", "#f2f2f2");
				let e = Math.max(0, u(p.now));
				r.fillRect(e, Ma, t - e, 54);
			}
			r.globalAlpha = .85, r.fillStyle = c;
			for (let e of ea(p.segments, l, t)) {
				let n = Math.max(0, u(e.start)), i = Math.min(t, u(e.end));
				r.fillRect(n, Ma, Math.max(1, i - n), Na);
			}
			r.globalAlpha = 1;
			for (let e of this.events) {
				if (e.end < l.start || e.start > l.start + l.span) continue;
				let t = u(e.start), n = Math.max(3, u(e.end) - t);
				r.fillStyle = la(ca(e.types)), r.fillRect(t, Pa, n, Fa);
			}
		}
		if (this.cursor !== void 0) {
			let e = Math.round(u(this.cursor)) + .5;
			r.strokeStyle = a("--accent-color", "#ff9800"), r.lineWidth = 2, r.beginPath(), r.moveTo(e, ja), r.lineTo(e, Aa), r.stroke();
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
      aria-valuetext=${this.cursor === void 0 ? "no position" : $(this.cursor, this.timeZone, !0)}
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
      height: ${Aa}px;
      touch-action: pan-y;
      cursor: pointer;
      border-radius: 6px;
    }
    canvas:focus-visible {
      outline: 2px solid var(--primary-color);
    }
  `;
};
function La(e, t, n) {
	try {
		n ? e?.setPointerCapture(t) : e?.releasePointerCapture(t);
	} catch {}
}
customElements.get("rv-timeline") || customElements.define("rv-timeline", Ia);
//#endregion
//#region src/components/playback.ts
var Ra = 6e4, za = 1e4, Ba = 86400, Va = 10 * Y, Ha = 10, Ua = 8e3, Wa = 3 * Y, Ga = 1e3, Ka = 6e4, qa = "reolink-viewer-check-setup", Ja = "reolink-viewer-player", Ya = !1, Xa = class extends M {
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
	_playSeq = 0;
	_hoverSeq = 0;
	_monthSeq = 0;
	_thumbsRequested = /* @__PURE__ */ new Set();
	thumbLoader = new Oa();
	_thumbPause;
	_eventsRetry;
	_eventsRetries = 0;
	_refreshTimer;
	_lastCursorPaint = 0;
	_progressive = Sn();
	_check;
	_starting;
	_preloadPending;
	_recoveredAt = -Infinity;
	_mseFailed = /* @__PURE__ */ new Set();
	_lastPreview = 0;
	constructor() {
		super(), this.deviceId = "", this.cameraName = "", this._date = "", this._loading = !1, this._view = {
			start: 0,
			span: Wi
		}, this._hidden = /* @__PURE__ */ new Set();
		let e = /* @__PURE__ */ new Date();
		this._month = {
			year: e.getFullYear(),
			month: e.getMonth() + 1
		}, this._monthDays = /* @__PURE__ */ new Set(), this._monthLoading = !1, this._stream = "sub", this._hd = {
			main: !1,
			reason: "checking…"
		}, this._thumbs = /* @__PURE__ */ new Map(), this._metrics = {}, this._checkText = "", this._checkRunning = !1, this._checkSetup = ro(), this._checkSession = !1, this._checkHdPart = ui(this._checkSetup), this._rate = 1, this._mode = io();
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return Sa(Date.now(), this._zone);
	}
	get _player() {
		return this.renderRoot.querySelector("rv-player");
	}
	get _timeline() {
		return this.renderRoot.querySelector("rv-timeline");
	}
	get _events() {
		return ia(this._day?.events ?? [], this._hidden);
	}
	connectedCallback() {
		super.connectedCallback(), this._refreshTimer = setInterval(() => {
			this._date === this._today && document.visibilityState !== "hidden" && this._loadDay(this._date, {
				keepView: !0,
				quiet: !0
			});
		}, Ra);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), clearInterval(this._refreshTimer), this._player?.stop(), this.thumbLoader.clear(), clearTimeout(this._thumbPause), clearTimeout(this._eventsRetry), this._check?.stop();
	}
	willUpdate(e) {
		if ((e.has("deviceId") || e.has("hass")) && this.hass && this.deviceId && !this._date) {
			this._date = this._today;
			let [e, t] = this._date.split("-").map(Number);
			e && t && (this._month = {
				year: e,
				month: t
			}), this._loadDay(this._date), this._loadMonth(this._month.year, this._month.month), this._checkHd(), Ya || (Ya = !0, Hi(this.hass).then((e) => {
				this._checkNote = e;
			}));
		}
	}
	async _loadDay(e, t = {}) {
		let n = this.hass;
		if (!n) return;
		let r = ++this._daySeq, i = performance.now(), a = !1;
		t.quiet || (this._loading = !0);
		try {
			let o = await He(n, this.deviceId, e, t.quiet ? 0 : Ba);
			if (r !== this._daySeq) return;
			let s = !this._day || this._day.date !== o.date;
			if (this._day = o, this._error = void 0, s || !t.keepView) {
				this._view = qi({
					start: o.start,
					span: o.end - o.start
				}, o);
				let e = o.events.at(-1)?.start ?? o.segments.at(-1)?.start;
				this._cursor = e;
			} else this._view = qi(this._view, o);
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
		}, za));
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
			let t = await Ze(e, this.deviceId);
			this._hd = await xn(t.main), this._metrics = {
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
		let t = this.hass, n = this._cursor === void 0 ? e.segments.at(-1) : ta(e.segments, this._cursor);
		!t || !n || n.end - n.start < Va || Ye(t, this._ref(n)).catch(() => void 0);
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
		let i = ra(r.segments, e);
		if (!i) {
			I(this, "No recording after this time on this day");
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
			let e = this._useMse(this._stream), r = this._progressive && i.offset < 3e3, c = this._ref(i.segment), l = e ? await Ge(n, c, o) : await We(n, c, r, o);
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
				delivery: e ? `MSE (${G() ?? "?"})${l.cache.complete ? ", cached" : ""}` : to(r, this._progressive, l.cache.complete)
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
		return !r?.mse || !this._useMse(this._stream) || !i || i.segmentId !== e.id || this._playing?.stream !== this._stream || i.end < e.end && t > i.end - Ka ? !1 : (this._metrics = {
			...this._metrics,
			urlMs: 0,
			firstFrameMs: void 0,
			delivery: `MSE (${G() ?? "?"}), same recording`
		}, r.seekWithin(Math.max(0, t - i.start), n), !0);
	}
	_describeMode() {
		let e = G();
		if (this._mode === "file") return "file player only (Debug setting)";
		if (!e) return "file player (this browser has no MSE)";
		if (typeof this.hass?.fetchWithAuth != "function") return "file player (no authenticated fetch)";
		let t = [...this._mseFailed];
		return `MSE (${e})${t.length ? `, file player for ${t.join(", ")} after a failure` : ""}`;
	}
	_useMse(e) {
		return this._mode === "auto" && G() !== void 0 && typeof this.hass?.fetchWithAuth == "function" && !this._mseFailed.has(e);
	}
	_release(e) {
		let t = this.hass, n = Ke(e.base ?? e.url ?? "");
		t && n && qe(t, [n]).catch(() => void 0);
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
		let n = this.hass, r = Ke(e.base ?? e.url ?? "");
		if (!n || !r || e.cache.complete) return;
		let i = () => t === this._playSeq && this._metrics.firstFrameMs === void 0 && !this._playFailure;
		for (; i() && (await Za(Ga), i());) try {
			let t = await Je(n, r);
			if (!i() || !t.cache || t.cache.complete || t.cache.error) break;
			let a = e.stream === "main" ? "HD " : "";
			this._note = `Fetching the ${a}recording from the recorder: ${Qa(t.cache.bytes)} of about ${Qa(t.expected_bytes)}`;
		} catch {
			break;
		}
		t === this._playSeq && (this._note = void 0);
	}
	_schedulePreload(e, t, n) {
		this._preloadPending = void 0;
		let r = this.hass, i = this._nextSegment(e);
		!r || !i || e.end - n <= Wa ? this._preloadAfter(e, t) : (this._player?.preload(void 0), Ye(r, this._ref(i)).catch(() => void 0), this._preloadPending = {
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
			let e = this._ref(r), i = this._useMse(this._stream) ? await Ge(n, e, r.start) : await We(n, e, this._progressive, r.start);
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
		}, Ua);
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
		}, I(this, `HD failed (${e}); back to the sub stream`, "error"), this._cursor !== void 0 && this.playAt(this._cursor)) : (this._playFailure = e, I(this, `Playback failed: ${e}`, "error"));
	}
	_onTime(e) {
		if (this._starting !== void 0) return;
		let t = performance.now();
		if (t - this._lastCursorPaint < 250) return;
		this._lastCursorPaint = t;
		let n = this._preloadPending;
		n && n.seq === this._playSeq && n.segment.end - e <= Wa && (this._preloadPending = void 0, this._preloadAfter(n.segment, n.seq)), this._cursor = e, (e > this._view.start + this._view.span || e < this._view.start) && (this._view = Xi(this._view, e, this._day ?? {
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
		let t = this._cursor ?? this._view.start, n = e > 0 ? aa(this._events, t) : oa(this._events, t);
		n ? (this._cursor = n.start, this._day && (this._view = Xi(this._view, n.start, this._day)), this.playAt(n.start)) : I(this, e > 0 ? "No later event" : "No earlier event");
	}
	_setRate(e) {
		this._rate = e;
	}
	_setMode(e) {
		this._mode = e, this._mseFailed.clear(), ao(e);
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
		this._date = e, this._player?.stop(), this._playing = void 0, this._preloadPending = void 0, this.thumbLoader.clear(), this._thumbs = /* @__PURE__ */ new Map(), this._thumbsRequested.clear(), this._loadDay(e);
		let [t, n] = e.split("-").map(Number);
		t && n && (t !== this._month.year || n !== this._month.month) && this._loadMonth(t, n);
	}
	async _onHover(e) {
		let t = this.hass;
		if (!t || !this._day || !ta(this._day.segments, e.time)) {
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
			let i = (await Xe(t, this.deviceId, [e.time], fa(this._view.span))).urls[0]?.url;
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
				let e = await Xe(t, this.deviceId, n, Ha), r = this._date;
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
		let t = new Ei(this._checkTarget(), e, () => {
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
			this._reports = (await Ui(this.hass)).reports;
		} catch (e) {
			I(this, `Could not load the reports: ${N(e).message}`, "error");
		}
	}
	async _copy(e) {
		await Gt(e) ? I(this, "Report copied") : I(this, "Copying is blocked here: select the report text and copy it", "error");
	}
	_renderCheck() {
		let e = this._checkRunning;
		return D`<div class="check">
      <strong>Playback check</strong>
      <p class="small muted">
        Measures this device: timeline, first frames (events, deep in long recordings, cached and not), auto-advance,
        playback rates, scrubbing, switching to HD and back, the link and MSE support. The report is saved on the
        server, so a run on a phone can be copied on a desktop.
      </p>
      ${this._checkNote ? D`<div class="banner error" role="alert">${this._checkNote}</div>` : k}
      <div class="row">
        <label
          >Setup
          <select
            ?disabled=${e}
            @change=${(e) => {
			this._checkSetup = e.target.value, this._checkHdPart = ui(this._checkSetup), oo(this._checkSetup);
		}}
          >
            ${li.map((e) => D`<option .value=${e} ?selected=${e === this._checkSetup}>${e}</option>`)}
          </select>
        </label>
        <label
          ><input
            type="checkbox"
            .checked=${this._checkSession}
            ?disabled=${e}
            @change=${(e) => {
			this._checkSession = e.target.checked;
		}}
          />
          then play for ${60} min (memory and disk)</label
        >
        <label
          title="The server fetches the main recording from the NVR (up to 3.8 GB for an hour, over the LAN); this device reads only seconds of it"
          ><input
            type="checkbox"
            .checked=${this._checkHdPart}
            ?disabled=${e}
            @change=${(e) => {
			this._checkHdPart = e.target.checked;
		}}
          />
          with HD</label
        >
      </div>
      <div class="row">
        ${e ? D`<button
              @click=${() => {
			this._check?.stop();
		}}
            >
              Stop
            </button>` : D`<button
              class="primary"
              @click=${() => void this.runCheck({
			setup: this._checkSetup,
			soakMinutes: this._checkSession ? 60 : 0,
			hd: this._checkHdPart
		})}
            >
              Run playback check
            </button>`}
        <button ?disabled=${!this._checkText} @click=${() => void this._copy(this._checkText)}>Copy report</button>
        <button @click=${() => void this._loadReports()}>Saved reports</button>
      </div>
      ${this._checkText ? D`<pre class="report">${this._checkText}</pre>` : k}
      ${this._reports ? D`<ul class="reports">
            ${this._reports.length ? this._reports.map((e) => D`<li>
                    <span>${new Date(e.updated).toLocaleString()} · ${e.setup}${e.done ? "" : " · running or cut short"}</span>
                    <button class="text" @click=${() => void this._copy(e.text)}>Copy</button>
                    <button
                      class="text"
                      @click=${() => {
			this._checkText = e.text;
		}}
                    >
                      Show
                    </button>
                  </li>`) : D`<li class="muted">No saved reports</li>`}
          </ul>` : k}
    </div>`;
	}
	_renderToolbar() {
		let e = Yi(this._view.span);
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
        <span class="small muted zoom">${so(this._view.span)}</span>
        <button
          aria-label="Zoom in"
          ?disabled=${e === Z.length - 1}
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
        <label class="small speed"
          >Speed
          <select
            aria-label="Playback speed"
            @change=${(e) => {
			this._setRate(Number(e.target.value));
		}}
          >
            ${Ea.map((e) => D`<option .value=${String(e)} ?selected=${e === this._rate}>${e}×</option>`)}
          </select></label
        >
        ${this._playing ? D`<a class="button" href=${this._playing.clip_url} download>Download clip</a>` : k}
      </div>
    </div>`;
	}
	_renderFilters() {
		let e = da(this._day?.events ?? []);
		return e.length ? D`<div class="chips" role="group" aria-label="Event types">
      ${e.map((e) => {
			let t = !this._hidden.has(e);
			return D`<button
          class="chip ${t ? "on" : ""}"
          aria-pressed=${t ? "true" : "false"}
          style="--chip: ${la(e)}"
          @click=${() => {
				let n = new Set(this._hidden);
				t ? n.add(e) : n.delete(e), this._hidden = n;
			}}
        >
          <span class="swatch"></span>${ua(e)}
          <span class="muted">${this._day?.events.filter((t) => t.types.includes(e)).length ?? 0}</span>
        </button>`;
		})}
    </div>` : k;
	}
	_renderHover() {
		let e = this._hover;
		return e ? D`<div class="hover" style="left: ${Math.max(0, e.x - 80)}px">
      ${e.gap ? k : e.url ? D`<img src=${e.url} alt="" />` : D`<div class="noimg"></div>`}
      <span>${$(e.time, this._zone, !0)}${e.gap ? " · no recording" : ""}</span>
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
        <dt>Reloaded mid-way</dt>
        <dd>${e.recoveries ? `${e.recoveries}× (last: ${e.lastRecovery ?? "?"})` : "never"}</dd>
        <dt>Stream</dt>
        <dd>${e.stream ?? this._stream}${e.codec ? ` · ${e.codec}` : ""}</dd>
        <dt>Cache</dt>
        <dd>${e.cache ? no(e.cache) : "–"}</dd>
        <dt>HD</dt>
        <dd>${this._hd.reason}</dd>
        <dt>Delivery</dt>
        <dd>
          ${e.delivery ?? (this._progressive ? "progressive" : "whole file first (WebKit)")}${this._playing?.file ? ` · ${this._playing.file} file` : ""}
        </dd>
        <dt>Player</dt>
        <dd>
          ${eo(this._player)}
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
      ${this._renderCheck()}
    </details>`;
	}
	render() {
		let e = this._day, t = this._zone;
		return D`
      <div class="layout">
        <div class="main">
          <rv-player
            .rate=${this._rate}
            .note=${this._note}
            @rv-first-frame=${(e) => {
			let t = this._metrics.codec ?? $a(this._player?.mseStats?.mime);
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
            <button class="text" aria-label="Previous day" @click=${() => {
			this._changeDay(-1);
		}}>‹</button>
            <strong>${e ? ba(e.start + 432e5, t) : this._date}</strong>
            <button
              class="text"
              aria-label="Next day"
              ?disabled=${this._date >= this._today}
              @click=${() => {
			this._changeDay(1);
		}}
            >›</button>
            <span class="muted small">
              ${this._cursor === void 0 ? "" : $(this._cursor, t, !0)}
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
			this._onScrub(e.detail.time);
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
            .firstDay=${wa(this.hass?.locale?.language)}
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
			this._cursor = e.detail.event.start, this._day && (this._view = Xi(this._view, e.detail.event.start, this._day)), this.playAt(e.detail.event.start);
		}}
            @rv-thumbs-needed=${(e) => void this._loadThumbs(e.detail.times)}
          ></rv-event-list>
        </div>
      </div>
    `;
	}
	static styles = [P, o`
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
      .speed {
        display: inline-flex;
        align-items: center;
        gap: 4px;
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
      .check {
        display: flex;
        flex-direction: column;
        gap: 6px;
        border-top: 1px solid var(--divider-color, #ccc);
        padding-top: 8px;
      }
      .check .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .check p {
        margin: 0;
      }
      .report {
        max-height: 50vh;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
        background: var(--secondary-background-color, #f5f5f5);
        padding: 8px;
        border-radius: 4px;
        user-select: text;
        -webkit-user-select: text;
      }
      .reports {
        margin: 0;
        padding-left: 18px;
        font-size: 13px;
      }
    `];
}, Za = (e) => new Promise((t) => {
	setTimeout(t, e);
}), Qa = (e) => `${Math.round(e / 1e6)} MB`;
function $a(e) {
	return /codecs="?([^",]+)/.exec(e ?? "")?.[1] ?? null;
}
function eo(e) {
	let t = e?.mseStats;
	return t ? [
		t.api,
		t.mime.replace(/^video\/mp4; codecs=/, ""),
		`${t.windows} windows, ${(t.bytes / 1e6).toFixed(1)} MB${t.lastWaitMs === void 0 ? "" : `, last in ${Math.round(t.lastWaitMs)} ms`}`,
		`${Math.round(t.ahead)} s ahead, ${Math.round(t.behind)} s behind`,
		`${t.trims} trims`
	].join(" · ") : e?.current ? "file player" : "–";
}
function to(e, t, n) {
	return n ? "cached file (Range)" : e ? "progressive" : t ? "whole file first (to seek)" : "whole file first (WebKit)";
}
function no(e) {
	let t = `${(e.bytes / 1e6).toFixed(1)} MB`;
	return e.error ? `failed: ${e.error}` : e.complete ? `cached (${t})` : `filling (${t} so far)`;
}
function ro() {
	try {
		let e = window.localStorage.getItem(qa);
		if (e && li.includes(e)) return e;
	} catch {}
	return Jt(navigator.userAgent);
}
function io() {
	try {
		return window.localStorage.getItem(Ja) === "file" ? "file" : "auto";
	} catch {
		return "auto";
	}
}
function ao(e) {
	try {
		window.localStorage.setItem(Ja, e);
	} catch {}
}
function oo(e) {
	try {
		window.localStorage.setItem(qa, e);
	} catch {}
}
function so(e) {
	return e >= 36e5 ? `${Math.round(e / 36e5)} h` : `${Math.round(e / Y)} min`;
}
customElements.get("rv-playback") || customElements.define("rv-playback", Xa);
//#endregion
//#region src/components/device-page.ts
var co = 1e3, lo = class extends M {
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
		return e.size === 1 && e.has("hass") && this._renderedStates !== void 0 ? Tt(this._renderedStates, this.hass?.states, this._watched) : !0;
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
			this._catalog = r, this._device = e, this._error = void 0, this._watched = ho(e);
		} catch (e) {
			if (n !== this._loadSeq) return;
			this._error = N(e).message;
		}
	}
	_subscribeRegistry(e) {
		this._unsubRegistry = e.connection.subscribeEvents((e) => {
			let t = e.data?.entity_id;
			(!t || this._device?.connections.some((e) => e.entities.some((e) => e.entity_id === t))) && (clearTimeout(this._reloadTimer), this._reloadTimer = setTimeout(() => void this.reload(), co));
		}, "entity_registry_updated").catch(() => void 0);
	}
	render() {
		this.renderCount += 1;
		let e = this._device, t = e?.node;
		return D`
      <div class="header">
        <button class="text back" @click=${() => {
			F(this, { view: "list" });
		}} aria-label="Back to all devices">← All devices</button>
      </div>
      ${this._error ? D`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : k}
      ${t ? D`<div class="title">
              <h2>${t.name ?? "Reolink device"}</h2>
              <span class="badge">${mt(t.kind)}</span>
              ${t.kind === "camera" && t.connections.length > 1 ? D`<span class="badge" title="In Home Assistant via the NVR and directly"
                    >${t.connections.length} connections</span
                  >` : k}
              <span class="muted small">${t.model ?? ""}</span>
            </div>
            <div class="tabs" role="tablist">
              ${mo(e).map((e) => D`<button
                  role="tab"
                  aria-selected=${this.tab === e ? "true" : "false"}
                  class=${this.tab === e ? "active" : ""}
                  @click=${() => {
			F(this, {
				view: "device",
				id: this.deviceId,
				tab: e
			});
		}}
                >
                  ${uo[e]}
                </button>`)}
            </div>
            ${e.degraded ? D`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>` : k}
            ${this.tab === "live" && po(e) ? D`<rv-live-camera .hass=${this.hass} .deviceId=${t.id}></rv-live-camera>` : this.tab === "playback" && fo(e) ? D`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${t.id}
                  .cameraName=${t.name ?? ""}
                ></rv-playback>` : this.tab === "overview" || this.tab === "playback" || this.tab === "live" ? D`<rv-overview .hass=${this.hass} .device=${e}></rv-overview>` : D`<rv-settings
                  .hass=${this.hass}
                  .device=${e}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}` : this._error ? k : D`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [P, o`
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
}, uo = {
	overview: "Overview",
	live: "Live",
	playback: "Playback",
	settings: "Settings"
};
function fo(e) {
	return e.node.kind === "camera" && e.node.connections.some((e) => e.playback_source);
}
function po(e) {
	return e.node.kind === "camera" && !e.degraded;
}
function mo(e) {
	return [
		"overview",
		...po(e) ? ["live"] : [],
		...fo(e) ? ["playback"] : [],
		"settings"
	];
}
function ho(e) {
	let t = e.connections.flatMap((e) => e.entities.map((e) => e.entity_id));
	return e.node.kind === "camera" && e.node.snapshot_entity_id && t.push(e.node.snapshot_entity_id), t;
}
customElements.get("rv-device-page") || customElements.define("rv-device-page", lo);
//#endregion
//#region src/types.ts
var go = [
	"sub",
	"main",
	"ext"
], _o = "reolink-viewer-live-check-setup";
function vo(e) {
	return !/Tailscale|Nabu Casa/.test(e);
}
var yo = class extends M {
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
		super(), this._setup = bo(), this._streams = [...go], this._warm = !0, this._stock = !0, this._capacity = !0, this._camera = "", this._checkText = "", this._checkStatus = "";
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
				let [t, n] = await Promise.all([Qe(e), $e(e)]);
				this._status = t, this._cameras = n.cameras;
			} catch (e) {
				this._error = N(e).message;
			}
			this._loadReports();
		}
	}
	async _loadReports() {
		if (this.hass) try {
			let { reports: e } = await Ui(this.hass);
			this._reports = e.filter((e) => e.setup.startsWith(Ln));
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
		let r = new Jn(t, {
			setup: e.setup,
			streams: e.streams ?? this._streams,
			warm: e.warm ?? this._warm,
			stock: e.stock ?? this._stock,
			capacity: e.capacity ?? (this._capacity && vo(e.setup)),
			cameraIds: e.cameraIds ?? (this._camera ? [this._camera] : [])
		}, n, () => {
			this._checkText = r.text, this._checkStatus = r.status;
		});
		this._check = r, this._copied = void 0;
		try {
			return await r.run();
		} finally {
			this._checkStatus = "", this._loadReports(), this._refreshStatus();
		}
	}
	async _refreshStatus() {
		this.hass && (this._status = await Qe(this.hass).catch(() => this._status));
	}
	async _copy(e, t) {
		await Gt(e) ? this._copied = t : (this._copied = void 0, this._shown = t, I(this, "Copying is blocked here: copy it from Saved reports on a computer, or select the text", "error"));
	}
	render() {
		let e = this._check?.running === !0;
		return D`<section class="card">
      <h2>Live check</h2>
      <p class="muted">
        Measures live view on this device, for every camera: the time to the first image and to the
        first live frame, over WebRTC and MSE, cold and kept warm, and the same in Home Assistant's own
        camera view. Run it on each setup (desktop on the LAN, the iPhone app on Wi-Fi, through
        Tailscale and through Nabu Casa) and send the reports. It only watches: it changes no camera
        setting. It takes several minutes; keep this page in front.
      </p>
      ${this._renderStatus()}
      <div class="options">
        <label
          >Setup
          <select
            .value=${this._setup}
            ?disabled=${e}
            @change=${(e) => {
			this._setup = e.target.value, xo(this._setup);
		}}
          >
            ${Rn.map((e) => D`<option value=${e} ?selected=${e === this._setup}>${e}</option>`)}
          </select>
        </label>
        <label
          >Cameras
          <select
            ?disabled=${e}
            @change=${(e) => {
			this._camera = e.target.value;
		}}
          >
            <option value="">All cameras</option>
            ${(this._cameras ?? []).map((e) => D`<option value=${e.id} ?selected=${e.id === this._camera}>${e.name}</option>`)}
          </select>
        </label>
        <span class="streams"
          >Streams
          ${go.map((t) => D`<label class="inline"
              ><input
                type="checkbox"
                .checked=${this._streams.includes(t)}
                ?disabled=${e}
                @change=${(e) => {
			let n = e.target.checked;
			this._streams = go.filter((e) => e === t ? n : this._streams.includes(e));
		}}
              />${t}</label
            >`)}
        </span>
        <label class="inline"
          ><input
            type="checkbox"
            .checked=${this._stock}
            ?disabled=${e}
            @change=${(e) => {
			this._stock = e.target.checked;
		}}
          />Compare with Home Assistant's camera view</label
        >
        ${this._admin ? D`<label class="inline"
                ><input
                  type="checkbox"
                  .checked=${this._warm}
                  ?disabled=${e}
                  @change=${(e) => {
			this._warm = e.target.checked;
		}}
                />Kept warm too (keeps each stream's camera connection open while it measures)</label
              >
              <label class="inline"
                ><input
                  type="checkbox"
                  .checked=${this._capacity}
                  ?disabled=${e}
                  @change=${(e) => {
			this._capacity = e.target.checked;
		}}
                />NVR capacity test (on the LAN setups: all sub streams, a main, a recording download)</label
              >` : k}
      </div>
      ${Yt(this._setup, navigator.userAgent) ? D`<div class="banner warning" role="alert">
            The setup “${this._setup}” is for another device: pick the one for this device, so the report is
            filed under it.
          </div>` : k}
      <div class="actions">
        ${e ? D`<button @click=${() => this._check?.stop()}>Stop</button>` : D`<button
              class="primary"
              ?disabled=${!this._streams.length || !this._cameras}
              @click=${() => {
			this.runCheck({ setup: this._setup }).catch((e) => {
				this._error = N(e).message;
			});
		}}
            >
              Run live check
            </button>`}
        ${this._checkText ? D`<button @click=${() => void this._copy(this._checkText, "current")}>
              ${this._copied === "current" ? "Copied" : "Copy report"}
            </button>` : k}
      </div>
      ${this._checkStatus ? D`<p class="muted" aria-live="polite">${this._checkStatus}…</p>` : k}
      ${this._error ? D`<div class="banner error" role="alert">${this._error}</div>` : k}
      <div class="stage" ?hidden=${!e} aria-label="Live video being measured"></div>
      ${this._checkText ? D`<pre class="report">${this._checkText}</pre>` : k}
      ${this._renderReports()}
    </section>`;
	}
	_renderStatus() {
		let e = this._status;
		if (!e) return k;
		let t = e.go2rtc;
		return D`<p class="muted small">
        go2rtc: ${t.state}${t.version ? ` ${t.version}` : ""}${t.error ? D` · <span class="error">${t.error}</span>` : k}
        ${t.state === "stopped" ? " (it starts with the first live stream)" : k}
      </p>
      ${t.log?.length ? D`<details>
            <summary>go2rtc log</summary>
            <pre>${t.log.join("\n")}</pre>
          </details>` : k}`;
	}
	_renderReports() {
		let e = this._reports;
		return e?.length ? D`<details>
      <summary>Saved reports (${e.length})</summary>
      <ul class="reports">
        ${e.map((e) => D`<li>
            <span
              >${[
			e.setup.slice(Ln.length),
			Ot(e.text),
			new Date(e.updated).toLocaleString()
		].filter(Boolean).join(" · ")}${e.done ? "" : " (not finished)"}</span
            >
            <button class="text" @click=${() => void this._copy(e.text, e.id)}>
              ${this._copied === e.id ? "Copied" : "Copy"}
            </button>
            ${this._shown === e.id ? D`<pre class="report">${e.text}</pre>` : k}
          </li>`)}
      </ul>
    </details>` : k;
	}
	static styles = [P, o`
      :host {
        display: block;
      }
      .options {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        align-items: center;
      }
      label.inline {
        display: inline-flex;
        gap: 4px;
        align-items: center;
      }
      .streams {
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin: 12px 0;
      }
      .stage[hidden] {
        display: none;
      }
      .stage {
        margin-bottom: 12px;
        width: 100%;
        max-width: 480px;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
      }
      .stage video {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      pre {
        max-height: 480px;
        overflow: auto;
        font-size: 12px;
        white-space: pre-wrap;
        background: var(--secondary-background-color, #f5f5f5);
        padding: 8px;
      }
      .reports {
        padding-inline-start: 16px;
      }
      .reports li {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .reports pre {
        flex-basis: 100%;
        user-select: text;
        -webkit-user-select: text;
      }
      .error {
        color: var(--error-color, #db4437);
      }
    `];
};
function bo() {
	try {
		let e = window.localStorage.getItem(_o);
		if (e && Rn.includes(e)) return e;
	} catch {}
	return Jt(navigator.userAgent);
}
function xo(e) {
	try {
		window.localStorage.setItem(_o, e);
	} catch {}
}
customElements.get("rv-live-check") || customElements.define("rv-live-check", yo);
//#endregion
//#region src/download.ts
function So(e, t, n = document) {
	let r = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = n.createElement("a");
	a.href = i, a.download = t, a.rel = "noopener", n.body.appendChild(a), a.click(), a.remove(), setTimeout(() => {
		URL.revokeObjectURL(i);
	}, 1e3);
}
//#endregion
//#region src/reolink-viewer-panel.ts
var Co = 6e3, wo = class extends M {
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
		this._route = St(window.location.hash);
	};
	constructor() {
		super(), this.narrow = !1, this._probe = { status: "idle" }, this._includeBattery = !1, this._concurrency = !1, this._maxStreams = 4, this._playback = !1, this._playbackOnly = !1, this._playbackConcurrency = !1, this._playbackStreams = 4, this._copied = !1, this._route = { view: "list" }, this.addEventListener(yt, (e) => {
			this.navigate(e.detail);
		}), this.addEventListener(bt, (e) => {
			this.showToast(e.detail);
		});
	}
	connectedCallback() {
		super.connectedCallback(), this._route = St(window.location.hash), window.addEventListener("hashchange", this._onHashChange);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener("hashchange", this._onHashChange), clearTimeout(this._toastTimer), this._run?.cancel(), this._run = void 0;
	}
	updated(e) {
		e.has("hass") && this.hass && !this._devices && !this._loading && (this._load(), Re(this.hass).catch(() => void 0));
	}
	navigate(e) {
		let t = xt(e);
		if (window.location.hash !== t) {
			let e = `${window.location.pathname}${window.location.search}${t}`;
			window.history.pushState(null, "", e);
		}
		e.view === "list" && this._route.view === "device" && this._load(), this._route = e;
	}
	showToast(e) {
		clearTimeout(this._toastTimer), this._toast = e, this._toastTimer = setTimeout(() => {
			this._toast = void 0;
		}, Co);
	}
	async _load() {
		if (this.hass) {
			this._loading = !0;
			try {
				this._devices = await Fe(this.hass), this._loadError = void 0, !this._warmed && !this._devices.degraded && (this._warmed = !0, Ue(this.hass).catch(() => void 0));
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
            ></rv-device-page>` : e.view === "live" ? D`<rv-live-grid .hass=${this.hass}></rv-live-grid>` : e.view === "live-check" ? D`<div>
                  <button class="text" @click=${() => {
			this.navigate({ view: "list" });
		}}>← Devices</button>
                </div>
                <rv-live-check .hass=${this.hass}></rv-live-check>` : e.view === "soak" ? D`<div>
                  <button class="text" @click=${() => {
			this.navigate({ view: "list" });
		}}>← Devices</button>
                </div>
                <h2>Soak report</h2>
                <rv-live-soak .hass=${this.hass}></rv-live-soak>` : D`${this._renderBanner()}
                ${this._loadError ? k : D`<rv-device-list .devices=${this._devices}></rv-device-list>`}
                ${this._renderLiveEntry()}
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
	_renderLiveEntry() {
		return !this._devices || this._devices.degraded ? k : D`<section class="card">
      <h2>Live view</h2>
      <p class="muted">
        Every camera live, each showing its last picture until its video starts. The live check
        measures how fast each camera starts on this device and compares it with Home Assistant's
        own camera view. The soak report says how live view held up with the grid open, from any
        device.
      </p>
      <div class="actions">
        <button class="primary" @click=${() => {
			this.navigate({ view: "live" });
		}}>
          Watch live
        </button>
        <button @click=${() => {
			this.navigate({ view: "live-check" });
		}}>
          Open the live check
        </button>
        <button @click=${() => {
			this.navigate({ view: "soak" });
		}}>
          Soak report
        </button>
      </div>
    </section>`;
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
				So(e.report, e.filename);
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
			let n = vt(/* @__PURE__ */ new Date());
			this._probe = {
				status: "done",
				report: e,
				filename: n
			}, So(e, n);
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
	static styles = [P, o`
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
customElements.get("reolink-viewer-panel") || customElements.define("reolink-viewer-panel", wo);
//#endregion
export { wo as ReolinkViewerPanel };
