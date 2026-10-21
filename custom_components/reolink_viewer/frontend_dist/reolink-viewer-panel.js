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
})(e) : e, { is: l, defineProperty: u, getOwnPropertyDescriptor: d, getOwnPropertyNames: f, getOwnPropertySymbols: p, getPrototypeOf: m } = Object, h = globalThis, g = h.trustedTypes, ee = g ? g.emptyScript : "", te = h.reactiveElementPolyfillSupport, _ = (e, t) => e, v = {
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
}, ne = (e, t) => !l(e, t), re = {
	attribute: !0,
	type: String,
	converter: v,
	reflect: !1,
	useDefault: !1,
	hasChanged: ne
};
Symbol.metadata ??= Symbol("metadata"), h.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
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
			let i = (n.converter?.toAttribute === void 0 ? v : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? v : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? ne)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
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
y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[_("elementProperties")] = /* @__PURE__ */ new Map(), y[_("finalized")] = /* @__PURE__ */ new Map(), te?.({ ReactiveElement: y }), (h.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var ie = globalThis, ae = (e) => e, oe = ie.trustedTypes, se = oe ? oe.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, ce = "$lit$", b = `lit$${Math.random().toFixed(9).slice(2)}$`, le = "?" + b, ue = `<${le}>`, x = document, S = () => x.createComment(""), C = (e) => e === null || typeof e != "object" && typeof e != "function", de = Array.isArray, fe = (e) => de(e) || typeof e?.[Symbol.iterator] == "function", pe = "[ 	\n\f\r]", w = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, me = /-->/g, he = />/g, T = RegExp(`>|${pe}(?:([^\\s"'>=/]+)(${pe}*=${pe}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), ge = /'/g, _e = /"/g, ve = /^(?:script|style|textarea|title)$/i, E = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), D = Symbol.for("lit-noChange"), O = Symbol.for("lit-nothing"), ye = /* @__PURE__ */ new WeakMap(), k = x.createTreeWalker(x, 129);
function be(e, t) {
	if (!de(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return se === void 0 ? t : se.createHTML(t);
}
var xe = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = w;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === w ? c[1] === "!--" ? o = me : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = T) : (ve.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = T) : o = he : o === T ? c[0] === ">" ? (o = i ?? w, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? T : c[3] === "\"" ? _e : ge) : o === _e || o === ge ? o = T : o === me || o === he ? o = w : (o = T, i = void 0);
		let d = o === T && e[t + 1].startsWith("/>") ? " " : "";
		a += o === w ? n + ue : l >= 0 ? (r.push(s), n.slice(0, l) + ce + n.slice(l) + b + d) : n + b + (l === -2 ? t : d);
	}
	return [be(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, Se = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = xe(t, n);
		if (this.el = e.createElement(l, r), k.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = k.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(ce)) {
					let t = u[o++], n = i.getAttribute(e).split(b), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? Ee : r[1] === "?" ? De : r[1] === "@" ? Oe : Te
					}), i.removeAttribute(e);
				} else e.startsWith(b) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (ve.test(i.tagName)) {
					let e = i.textContent.split(b), t = e.length - 1;
					if (t > 0) {
						i.textContent = oe ? oe.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], S()), k.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], S());
					}
				}
			} else if (i.nodeType === 8) {
				if (i.data === le) c.push({
					type: 2,
					index: a
				});
				else {
					let e = -1;
					for (; (e = i.data.indexOf(b, e + 1)) !== -1;) c.push({
						type: 7,
						index: a
					}), e += b.length - 1;
				}
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = x.createElement("template");
		return n.innerHTML = e, n;
	}
};
function A(e, t, n = e, r) {
	if (t === D) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = C(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = A(e, i._$AS(e, t.values), i, r)), t;
}
var Ce = class {
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
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? x).importNode(t, !0);
		k.currentNode = r;
		let i = k.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new we(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new ke(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = k.nextNode(), a++);
		}
		return k.currentNode = x, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, we = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = O, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
		e = A(this, e, t), C(e) ? e === O || e == null || e === "" ? (this._$AH !== O && this._$AR(), this._$AH = O) : e !== this._$AH && e !== D && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? fe(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== O && C(this._$AH) ? this._$AA.nextSibling.data = e : this.T(x.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = Se.createElement(be(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new Ce(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = ye.get(e.strings);
		return t === void 0 && ye.set(e.strings, t = new Se(e)), t;
	}
	k(t) {
		de(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(S()), this.O(S()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = ae(e).nextSibling;
			ae(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, Te = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = O, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = O;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = A(this, e, t, 0), a = !C(e) || e !== this._$AH && e !== D, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = A(this, r[n + o], t, o), s === D && (s = this._$AH[o]), a ||= !C(s) || s !== this._$AH[o], s === O ? e = O : e !== O && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === O ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, Ee = class extends Te {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === O ? void 0 : e;
	}
}, De = class extends Te {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== O);
	}
}, Oe = class extends Te {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = A(this, e, t, 0) ?? O) === D) return;
		let n = this._$AH, r = e === O && n !== O || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== O && (n === O || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, ke = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		A(this, e);
	}
}, Ae = ie.litHtmlPolyfillSupport;
Ae?.(Se, we), (ie.litHtmlVersions ??= []).push("3.3.3");
var je = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new we(t.insertBefore(S(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, Me = globalThis, j = class extends y {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = je(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return D;
	}
};
j._$litElement$ = !0, j.finalized = !0, Me.litElementHydrateSupport?.({ LitElement: j });
var Ne = Me.litElementPolyfillSupport;
Ne?.({ LitElement: j }), (Me.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region src/api.ts
var Pe = (e) => e.callWS({ type: "reolink_viewer/devices" }), Fe = (e, t) => e.callWS({
	type: "reolink_viewer/device",
	device_id: t
}), Ie = /* @__PURE__ */ new WeakMap();
function Le(e) {
	let t = Ie.get(e.connection);
	return t || (t = e.callWS({ type: "reolink_viewer/catalog" }), Ie.set(e.connection, t), t.catch(() => Ie.delete(e.connection))), t;
}
var Re = (e, t) => e.callWS({
	type: "config/entity_registry/update",
	entity_id: t,
	disabled_by: null
});
function ze(e, t, n) {
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
				i = !0, c(M(e));
			});
		}),
		cancel: () => {
			i || (i = !0, o(), a(/* @__PURE__ */ Error("Probe cancelled")));
		}
	};
}
function M(e) {
	return e instanceof Error ? e : typeof e == "object" && e && "message" in e ? Error(String(e.message)) : Error(String(e));
}
var Be = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/timeline/days",
	device_id: t,
	year: n,
	month: r
}), Ve = (e, t, n, r = 0) => e.callWS({
	type: "reolink_viewer/timeline/day",
	device_id: t,
	date: n,
	...r > 0 ? { max_age: r } : {}
}), He = (e) => e.callWS({ type: "reolink_viewer/timeline/warm" }), Ue = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/playback/url",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	progressive: n,
	...r === void 0 ? {} : { at: Math.round(r) }
}), We = (e, t, n) => e.callWS({
	type: "reolink_viewer/playback/mse",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream,
	...n === void 0 ? {} : { at: Math.round(n) }
});
function Ge(e) {
	return e.split("?")[0]?.split("/").at(-1) ?? "";
}
var Ke = (e, t) => e.callWS({
	type: "reolink_viewer/playback/cache_status",
	token: t
}), qe = (e, t) => e.callWS({
	type: "reolink_viewer/playback/prefetch",
	device_id: t.deviceId,
	date: t.date,
	segment_id: t.segmentId,
	stream: t.stream
}), Je = (e, t, n, r) => e.callWS({
	type: "reolink_viewer/thumbnail/urls",
	device_id: t,
	times: n,
	bucket: r
}), Ye = (e, t) => e.callWS({
	type: "reolink_viewer/playback/media_info",
	device_id: t
}), Xe = {
	camera: "Camera",
	nvr: "NVR",
	hub: "Home Hub"
}, Ze = (e) => Xe[e];
function Qe(e) {
	let t = [];
	return e.codec && t.push($e(e.codec)), e.frame_rate && t.push(`${e.frame_rate} fps`), e.bit_rate && t.push(`${e.bit_rate} kbps`), t.length ? t.join(" · ") : "unknown";
}
function $e(e) {
	switch (e.toLowerCase()) {
		case "h264": return "H.264";
		case "h265":
		case "hevc": return "H.265";
		default: return e;
	}
}
function et(e) {
	return e === null ? "unknown" : e ? "on" : "off";
}
function tt(e) {
	return `reolink-viewer-probe-${e.toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
}
//#endregion
//#region src/styles.ts
var N = o`
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
`, nt = "rv-navigate", rt = "rv-toast";
function P(e, t) {
	e.dispatchEvent(new CustomEvent(nt, {
		detail: t,
		bubbles: !0,
		composed: !0
	}));
}
function F(e, t, n = "info") {
	e.dispatchEvent(new CustomEvent(rt, {
		detail: {
			message: t,
			kind: n
		},
		bubbles: !0,
		composed: !0
	}));
}
function it(e) {
	return e.view === "list" ? "" : `#device/${encodeURIComponent(e.id)}/${e.tab}`;
}
function at(e) {
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
var ot = class extends j {
	static properties = { devices: { attribute: !1 } };
	render() {
		let e = this.devices;
		if (!e) return E`<p class="muted">Loading devices…</p>`;
		if (!e.hosts.length && !e.cameras.length) return E`<section class="card">
        <h2>No Reolink devices</h2>
        <p class="muted">
          Set up your cameras, NVRs or Home Hubs in the Reolink integration first; they appear
          here once loaded.
        </p>
      </section>`;
		let t = new Map(e.cameras.map((e) => [e.id, e])), n = e.cameras.filter((e) => e.host_id === null);
		return E`
      ${e.hosts.map((e) => this._renderHost(e, t))}
      ${n.length ? E`<section class="card">
            <h2>Cameras added directly</h2>
            <ul class="devices">
              ${n.map((e) => this._renderCamera(e))}
            </ul>
          </section>` : O}
    `;
	}
	_renderHost(e, t) {
		let n = e.camera_ids.map((e) => t.get(e)).filter((e) => e !== void 0);
		return E`<section class="card">
      <div class="host-header">
        <button class="link title" @click=${() => {
			P(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}>
          ${e.name ?? e.entry_title}
        </button>
        <span class="badge">${Ze(e.kind)}</span>
      </div>
      <p class="muted small">
        ${[e.model, e.sw_version && `firmware ${e.sw_version}`].filter(Boolean).join(" · ")}
      </p>
      ${n.length ? E`<ul class="devices">
            ${n.map((t) => this._renderCamera(t, e))}
          </ul>` : E`<p class="muted">No cameras on this ${Ze(e.kind)}.</p>`}
    </section>`;
	}
	_renderCamera(e, t) {
		let n = t ? e.connections.find((e) => e.host_id === t.id)?.channel : void 0, r = t !== void 0 && e.connections.some((e) => e.via === "direct");
		return E`<li>
      <button
        class="row"
        @click=${() => {
			P(this, {
				view: "device",
				id: e.id,
				tab: "overview"
			});
		}}
      >
        <span class="name">
          ${n == null ? O : E`<span class="muted">Ch ${n + 1}</span> `}${e.name ?? "Camera"}
        </span>
        <span class="muted small">${e.model ?? ""}</span>
        <span class="badges">
          ${st(e)}
          ${r ? E`<span class="badge" title="Also added to Home Assistant directly"
                >+ direct</span
              >` : O}
          ${e.primary_view === "snapshot" ? E`<span class="badge" title="Does not record: snapshots are its main view"
                >snapshots</span
              >` : O}
        </span>
      </button>
    </li>`;
	}
	static styles = [N, o`
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
function st(e) {
	let t = e.status;
	return t.online === !1 ? E`<span class="badge warning">offline</span>` : t.sleeping ? E`<span class="badge">sleeping</span>` : O;
}
customElements.get("rv-device-list") || customElements.define("rv-device-list", ot);
//#endregion
//#region src/render-filter.ts
function ct(e, t, n) {
	if (e === t) return !1;
	if (!e || !t) return !0;
	for (let r of n) if (e[r] !== t[r]) return !0;
	return !1;
}
//#endregion
//#region src/catalog.ts
var lt = {
	id: "other",
	title: "Other",
	description: "Entities this version of Reolink Viewer does not know yet."
};
function ut(e, t, n) {
	if (e && n !== null) return e.entities[t]?.[n];
}
function dt(e, t) {
	let n = t.indexOf(".");
	if (!(n < 0)) return ut(e, t.slice(0, n), t.slice(n + 1));
}
function ft(e) {
	return [...e?.categories ?? [], lt];
}
function pt(e, t) {
	if (e?.impact !== "disruptive") return null;
	let n = e.disruptive_when ?? "any", r;
	return r = Array.isArray(n) ? typeof t == "object" && n.includes(t.option) : n === "any" || t === n, r ? e.impact_note ?? "This action can disrupt the camera." : null;
}
function mt(e, t) {
	return e.name ?? t?.title ?? e.entity_id;
}
var ht = (e) => e.toLowerCase();
function gt(e, t, n) {
	let r = ht(n).split(/\s+/).filter(Boolean);
	if (!r.length) return !0;
	let i = ht([
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
function _t(e, t) {
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
function vt(e) {
	return {
		domain: "light",
		service: "turn_on",
		data: { brightness_pct: e }
	};
}
//#endregion
//#region src/writes.ts
var yt = 1e4, bt = class {
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
}, xt = 1, St = class extends j {
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
	writes = new bt();
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
			let e = ut(this.catalog, n.domain, n.key);
			if (!gt(n, e, this._search)) continue;
			let r = t.get(n.category) ?? [];
			r.push({
				entity: n,
				entry: e,
				label: mt(n, e)
			}), t.set(n.category, r);
		}
		for (let e of t.values()) e.sort((e, t) => e.label.localeCompare(t.label));
		return t;
	}
	render() {
		let e = this.connection;
		if (!this.device || !e) return E`<p class="muted">No settings.</p>`;
		let t = this._rows(e), n = e.entities.filter((e) => e.disabled_by !== null).length, r = ft(this.catalog).filter((e) => t.has(e.id));
		return E`
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
      ${this._showDisabled ? E`<p class="banner info small">
            Home Assistant creates some Reolink entities disabled.
            ${this.hass?.user?.is_admin ? "Enabling one makes Home Assistant reload the Reolink integration entry for this device after about 30 seconds; its entities are briefly unavailable and the new one appears then." : "An administrator can enable them."}
          </p>` : O}
      ${r.length ? r.map((e) => E`<section class="category">
              <h3>${e.title}</h3>
              <p class="muted small">${e.description}</p>
              <ul class="rows">
                ${(t.get(e.id) ?? []).map((e) => this._renderRow(e))}
              </ul>
            </section>`) : E`<p class="muted">No settings match “${this._search}”.</p>`}
      ${this._renderConfirm()}
    `;
	}
	_renderConnections() {
		let e = this.device?.connections ?? [];
		if (e.length < 2) return O;
		let t = this.connection;
		return E`<div class="connections" role="radiogroup" aria-label="Settings via">
      <span class="small muted">Settings via</span>
      ${e.map((e, n) => E`<button
          role="radio"
          aria-checked=${e === t ? "true" : "false"}
          class=${e === t ? "primary" : ""}
          @click=${() => {
			this._connection = n;
		}}
        >
          ${Ct(e)} (${e.entities.length})
        </button>`)}
      <span class="small muted">
        Both connections reach the same camera; a change made through either applies to it.
      </span>
    </div>`;
	}
	_renderRow(e) {
		let { entity: t, entry: n, label: r } = e, i = this._open.has(t.entity_id);
		return E`<li class="row" data-entity-id=${t.entity_id}>
      <div class="info">
        <div class="label">
          ${r}
          ${t.sub_device ? E`<span class="badge">${t.sub_device}</span>` : O}
          ${t.disabled_by === null ? O : E`<span class="badge">disabled</span>`}
          ${t.hidden_by === null ? O : E`<span class="badge">hidden</span>`}
          ${t.entity_category === "diagnostic" ? E`<span class="badge">diagnostic</span>` : O}
          ${n?.impact === "disruptive" ? E`<span class="badge warning" title=${n.impact_note ?? ""}>disruptive</span>` : O}
        </div>
        ${n ? E`<div class="muted small">${n.summary}</div>` : O}
      </div>
      <div class="control">${this._renderControl(t, r)}</div>
      ${n ? E`<details
            class="about"
            .open=${i}
            @toggle=${(e) => {
			this._setOpen(t.entity_id, e.target.open);
		}}
          >
            <summary class="small">About this setting</summary>
            ${i ? this._renderAbout(n) : O}
          </details>` : O}
    </li>`;
	}
	_setOpen(e, t) {
		if (this._open.has(e) === t) return;
		let n = new Set(this._open);
		t ? n.add(e) : n.delete(e), this._open = n;
	}
	_renderAbout(e) {
		let t = e.related.map((e) => dt(this.catalog, e)?.title).filter((e) => e !== void 0);
		return E`<div class="about-body small">
      ${e.verification === "unverified" ? E`<p class="unverified">
            <span class="badge warning">unverified</span> Reolink does not document exactly what
            this does; the text says only what is known.
          </p>` : O}
      <p>${e.what_it_does}</p>
      ${e.tradeoffs ? E`<p><strong>Trade-offs:</strong> ${e.tradeoffs}</p>` : O}
      ${e.impact === "disruptive" ? E`<p><strong>Impact:</strong> ${e.impact_note}</p>` : O}
      <p><strong>Requires:</strong> ${e.requires}</p>
      ${e.notes ? E`<p>${e.notes}</p>` : O}
      ${t.length ? E`<p><strong>Related:</strong> ${t.join(", ")}</p>` : O}
      <p>
        <strong>Sources:</strong>
        ${e.sources.map((e, t) => E`${t ? ", " : ""}<a href=${e.url} target="_blank" rel="noreferrer"
              >${e.title}</a
            >`)}
      </p>
    </div>`;
	}
	_renderControl(e, t) {
		if (e.disabled_by !== null) {
			if (!this.hass?.user?.is_admin) return E`<span class="muted small">Disabled</span>`;
			let n = this._enabling.has(e.entity_id);
			return E`<button ?disabled=${n} @click=${() => void this._enable(e, t)}>
        ${n ? "Enabling…" : "Enable"}
      </button>`;
		}
		let n = this.hass?.states[e.entity_id];
		if (!n) return E`<span class="muted small">Not loaded yet</span>`;
		let r = e.entity_id, i = this.writes.isPending(r), a = this.writes.valueFor(r), o = n.state === "unavailable" || i;
		switch (e.domain) {
			case "switch":
			case "siren": return this._toggle(e, t, a ?? n.state === "on", o && !i);
			case "light": return this._light(e, t, n, a, o && !i);
			case "number": return this._number(e, t, n, a, o);
			case "select": return this._select(e, t, n, a, o);
			case "time": return E`<input
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
			case "button": return E`<button
          ?disabled=${o}
          @click=${() => void this._write(e, t, "press", "any")}
        >
          ${i ? "Pressing…" : "Press"}
        </button>`;
			case "update": return this._update(e, t, n, i);
			default: return E`<span class="value">${Tt(n, e.domain)}</span>`;
		}
	}
	_toggle(e, t, n, r) {
		let i = n === !0;
		return E`<button
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
		return E`<span class="light">
      ${o && l ? E`<input
            type="range"
            min="1"
            max="100"
            aria-label="${t} brightness"
            .value=${String(typeof r == "number" ? r : c)}
            ?disabled=${i}
            @change=${(n) => {
			let r = Number(n.target.value);
			this._write(e, t, r, "on", vt(r));
		}}
          />` : O}
      ${this._toggle(e, t, l, i)}
    </span>`;
	}
	_number(e, t, n, r, i) {
		let a = n.attributes, o = wt(a.min, 0), s = wt(a.max, 100), c = wt(a.step, 1), l = typeof a.unit_of_measurement == "string" ? a.unit_of_measurement : "", u = Number(n.state), d = typeof r == "number" ? r : u, f = Number.isFinite(d) ? String(d) : "", p = (n) => {
			let r = n.target, i = Number(r.value);
			r.value === "" || !Number.isFinite(i) || i < o || i > s ? r.value = f : i !== d && this._write(e, t, i, "any");
		};
		return E`<span class="number">
      ${a.mode === "box" ? O : E`<input
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
      ${l ? E`<span class="unit muted small">${l}</span>` : O}
    </span>`;
	}
	_select(e, t, n, r, i) {
		let a = Array.isArray(n.attributes.options) ? n.attributes.options.map(String) : [], o = typeof r == "string" ? r : n.state;
		return E`<select
      aria-label=${t}
      ?disabled=${i}
      @change=${(n) => {
			let r = n.target, i = r.value;
			r.value = o, this._write(e, t, i, { option: i });
		}}
    >
      ${a.includes(o) ? O : E`<option value="" selected>—</option>`}
      ${a.map((e) => E`<option value=${e} ?selected=${e === o}>${e}</option>`)}
    </select>`;
	}
	_update(e, t, n, r) {
		let i = n.attributes, a = typeof i.installed_version == "string" ? i.installed_version : "?", o = typeof i.latest_version == "string" ? i.latest_version : null, s = typeof i.supported_features == "number" ? i.supported_features : 0, c = i.in_progress === !0 || r, l = n.state === "on" && (s & xt) !== 0;
		return E`<span class="update small">
      <span>
        ${a}${o && o !== a ? E` → <strong>${o}</strong>` : O}
        ${n.state === "off" ? E`<span class="muted">(up to date)</span>` : O}
      </span>
      ${l || c ? E`<button
            ?disabled=${c}
            @click=${() => void this._write(e, t, "install", "any")}
          >
            ${c ? "Installing…" : "Install"}
          </button>` : O}
    </span>`;
	}
	async _write(e, t, n, r, i) {
		let a = this.hass;
		if (!a) return;
		let o = pt(ut(this.catalog, e.domain, e.key), r);
		if (o !== null && !await this.confirm(t, o)) return;
		let s = i ?? _t(e.domain, e.domain === "button" ? "press" : e.domain === "update" ? "install" : n), c = e.entity_id, l = this.writes.begin(c, n, a.states[c]);
		this.requestUpdate();
		try {
			await a.callService(s.domain, s.service, s.data, { entity_id: c }, !1), this.writes.confirm(c, l), this._scheduleSettle();
		} catch (e) {
			this.writes.fail(c, l) && F(this, `Could not change ${t}: ${M(e).message}`, "error");
		}
		this.requestUpdate();
	}
	_scheduleSettle() {
		clearTimeout(this._settleTimer), this._settleTimer = setTimeout(() => {
			this.hass && this.writes.settle(this.hass.states) && this.requestUpdate(), this.writes.size && this._scheduleSettle();
		}, yt + 100);
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
		return e ? E`<div class="scrim" @click=${() => {
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
    </div>` : O;
	}
	async _enable(e, t) {
		let n = this.hass;
		if (n) {
			this._enabling = /* @__PURE__ */ new Set([...this._enabling, e.entity_id]);
			try {
				let r = (await Re(n, e.entity_id)).reload_delay;
				F(this, `${t} enabled. Home Assistant reloads the Reolink entry${r ? ` in about ${r} seconds` : ""}; the entity becomes available after that.`), this.dispatchEvent(new CustomEvent("rv-entity-enabled", {
					bubbles: !0,
					composed: !0
				}));
			} catch (e) {
				F(this, `Could not enable ${t}: ${M(e).message}`, "error");
			} finally {
				let t = new Set(this._enabling);
				t.delete(e.entity_id), this._enabling = t;
			}
		}
	}
	static styles = [N, o`
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
function Ct(e) {
	return e.via === "nvr" ? `NVR (${e.host_name ?? e.entry_title})` : "Direct";
}
function wt(e, t) {
	return typeof e == "number" && Number.isFinite(e) ? e : t;
}
function Tt(e, t) {
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
customElements.get("rv-settings") || customElements.define("rv-settings", St);
//#endregion
//#region src/components/overview.ts
var Et = 3e4, Dt = {
	people: "person",
	dog_cat: "animal",
	"non-motor_vehicle": "bicycle"
}, Ot = class extends j {
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
		}, Et));
	}
	snapshotUrl() {
		let e = this.device?.node;
		if (e?.kind !== "camera" || !e.snapshot_entity_id) return null;
		let t = this.hass?.states[e.snapshot_entity_id]?.attributes.entity_picture;
		return typeof t != "string" || !t ? null : this._stamp ? `${t}${t.includes("?") ? "&" : "?"}_=${this._stamp}` : t;
	}
	render() {
		let e = this.device;
		if (!e) return E``;
		let t = e.node;
		return E`
      ${t.kind === "camera" ? this._renderSnapshot(t) : this._renderCameras()}
      ${e.connections.map((t) => this._renderConnection(t, e))}
    `;
	}
	_renderSnapshot(e) {
		let t = this.snapshotUrl(), n = e.primary_view === "snapshot";
		return E`<section class="card snapshot ${n ? "primary" : ""}">
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
      ${n ? E`<p class="muted small">
            This camera does not record, so snapshots are its main view. The picture refreshes
            every ${Et / 1e3} seconds while this page is open.
          </p>` : O}
      ${t ? E`<img src=${t} alt="Latest snapshot of ${e.name ?? "the camera"}" />` : E`<p class="muted">
            No snapshot: enable one of this camera's stream entities (for example
            <em>Fluent</em>) in the Settings tab.
          </p>`}
    </section>`;
	}
	_renderCameras() {
		let e = this.device?.node;
		return e?.kind === "camera" ? O : E`<section class="card">
      <h2>${Ze(e?.kind ?? "nvr")}</h2>
      <p class="muted small">${e?.camera_ids.length ?? 0} cameras; open one from the list.</p>
      <button class="link" @click=${() => {
			P(this, { view: "list" });
		}}>All devices</button>
    </section>`;
	}
	_renderConnection(e, t) {
		let n = e.details, r = t.node.kind === "camera";
		return E`<section class="card">
      <div class="header">
        <h2>${r ? Ct(e) : "Device"}</h2>
        ${e.playback_source ? E`<span class="badge accent">playback source</span>` : O}
        ${e.channel !== void 0 && e.channel !== null && e.via === "nvr" ? E`<span class="badge">channel ${e.channel + 1}</span>` : O}
      </div>
      ${n === null ? E`<p class="muted">
            Details are unavailable${t.degraded ? " in degraded mode" : ""}.
          </p>` : E`
            ${n.channel ? kt(n.channel) : O}
            ${e.via === "direct" || !r ? At(n.host) : O}
          `}
      <p class="muted small">
        ${e.entities.length} entities
        (${e.entities.filter((e) => e.disabled_by !== null).length} disabled)
      </p>
    </section>`;
	}
	static styles = [N, o`
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
function kt(e) {
	let t = e.online ? e.sleeping ? "sleeping" : "online" : "offline";
	return E`<dl class="facts">
    <dt>Model</dt>
    <dd>${e.model}${e.model_id ? E` <span class="muted">(${e.model_id})</span>` : O}</dd>
    <dt>Hardware</dt>
    <dd>${e.hardware_version}</dd>
    <dt>Firmware</dt>
    <dd>${e.firmware_version}</dd>
    <dt>Status</dt>
    <dd>${t}</dd>
    <dt>Clear stream</dt>
    <dd>${Qe(e.encodings.main)}</dd>
    <dt>Fluent stream</dt>
    <dd>${Qe(e.encodings.sub)}</dd>
    <dt>Network</dt>
    <dd>${jt(e.network)}</dd>
    ${e.battery ? E`<dt>Battery</dt>
          <dd>
            ${e.battery.percent ?? "?"}%${e.battery.status ? ` · ${e.battery.status}` : ""}${e.battery.temperature_c === null ? "" : ` · ${e.battery.temperature_c} °C`}
          </dd>` : O}
    <dt>Recordings</dt>
    <dd>${e.supports_replay ? "playback supported" : "no playback"}</dd>
    ${e.ai_types.length ? E`<dt>AI detection</dt>
          <dd>${e.ai_types.map((e) => Dt[e] ?? e).join(", ")}</dd>` : O}
    ${e.capabilities.length ? E`<dt>Features</dt>
          <dd class="chips">${e.capabilities.map((e) => E`<span class="badge">${e}</span>`)}</dd>` : O}
  </dl>`;
}
function At(e) {
	let t = e.ports;
	return E`<dl class="facts">
    ${e.device_type === "camera" ? O : E`<dt>Model</dt>
          <dd>${e.model ?? "?"}${e.model_id ? E` <span class="muted">(${e.model_id})</span>` : O}</dd>
          <dt>Hardware</dt>
          <dd>${e.hardware_version ?? "?"}</dd>
          <dt>Firmware</dt>
          <dd>${e.firmware_version ?? "?"}</dd>
          <dt>Channels</dt>
          <dd>${e.channels}</dd>`}
    <dt>Connection</dt>
    <dd>
      ${jt(e.network)} · ${t.http.https ? "HTTPS" : "HTTP"}${t.http.port ? ` port ${t.http.port}` : ""}${e.baichuan_only ? " · Baichuan only" : ""}
    </dd>
    <dt>Protocols</dt>
    <dd>
      RTSP ${et(t.rtsp.enabled)}${t.rtsp.port ? ` (${t.rtsp.port})` : ""} · RTMP
      ${et(t.rtmp.enabled)}${t.rtmp.port ? ` (${t.rtmp.port})` : ""} · ONVIF
      ${et(t.onvif.enabled)}${t.onvif.port ? ` (${t.onvif.port})` : ""}
    </dd>
    <dt>HA stream protocol</dt>
    <dd>${e.stream_protocol ?? "?"}</dd>
    <dt>Storage</dt>
    <dd>
      ${e.storage.length ? e.storage.map((e, t) => E`${t ? E`<br />` : O}${e.type ?? "disk"} ${e.index + 1}:
              ${e.used_percent === null ? "?" : `${e.used_percent}% used`}${e.available === !1 ? " (not available)" : ""}`) : "none"}
    </dd>
    ${e.cpu_usage === null ? O : E`<dt>CPU</dt>
          <dd>${e.cpu_usage}%</dd>`}
    ${e.capabilities.length ? E`<dt>Host features</dt>
          <dd class="chips">${e.capabilities.map((e) => E`<span class="badge">${e}</span>`)}</dd>` : O}
  </dl>`;
}
function jt(e) {
	return e.connection === "wifi" ? e.wifi_signal_dbm === null ? "Wi-Fi" : `Wi-Fi, ${e.wifi_signal_dbm} dBm` : "Ethernet";
}
customElements.get("rv-overview") || customElements.define("rv-overview", Ot);
//#endregion
//#region src/playback/check-util.ts
function Mt(e) {
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
function Nt(e) {
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
var I = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, L = (e) => e === void 0 ? "–" : Math.abs(e) >= 1e9 ? `${(e / 1e9).toFixed(2)} GB` : `${(e / 1e6).toFixed(1)} MB`;
function R(e) {
	return e < 6e4 ? `${Math.round(e / 1e3)} s` : `${(e / 6e4).toFixed(1)} min`;
}
function Pt(e, t, n, r, i) {
	let a = e.end - e.start, o = e.start + a * n, s = e.start + a * r, c = t.filter((e) => e.start >= o && e.start <= s).at(-1);
	return {
		time: c ? c.start : Math.round(e.start + a * i),
		event: c
	};
}
function Ft(e, t) {
	return e.filter((e) => e.end - e.start >= 12e5 && t - e.end > 6e4).sort((e, t) => t.start - e.start);
}
function It(e) {
	let t = [];
	return e.forEach((n, r) => {
		let i = e.at(r + 1);
		i && i.start - n.end < 2e3 && t.push([n, i]);
	}), t.sort((e, t) => e[0].end - e[0].start - (t[0].end - t[0].start));
}
function Lt(e) {
	return e.decoded && e.mediaS > 0 ? e.decoded / e.mediaS : void 0;
}
function Rt(e) {
	let t = [`${(e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0).toFixed(2)}× effective`];
	e.applied !== e.rate && t.push(`browser set ${e.applied}×`);
	let n = Lt(e);
	if (e.painted !== void 0) {
		let r = `${(e.painted * 1e3 / e.wallMs).toFixed(0)} fps painted`;
		t.push(n ? `${r} of ${(n * e.rate).toFixed(0)}` : r);
	}
	if (e.maxGapMs !== void 0 && t.push(`longest frame gap ${Math.round(e.maxGapMs)} ms`), e.decoded !== void 0 && e.dropped !== void 0) {
		let n = e.decoded ? (e.dropped * 100 / e.decoded).toFixed(1) : "0.0";
		t.push(`dropped ${e.dropped} of ${e.decoded} frames (${n} %)`);
	}
	return t.push(`${e.stalls} stalls${e.stalls ? ` (${Math.round(e.stalledMs)} ms)` : ""}`), e.ended && t.push("the file ended"), Bt(e) || t.push("the dropped-frame counter disagrees with the frames painted: judged by those"), e.focused || t.push("PAGE NOT IN FRONT"), `${String(e.rate).padStart(3)}×: ${t.join(", ")}`;
}
var zt = "on pace (±10 %), stalls under 100 ms, no frame gap over 2.5 frames (250 ms at least); below 50 fps to show, ≤ 2 % (or 1 frame) dropped, or 90 % painted where the dropped-frame counter disagrees with the frames painted";
function Bt(e) {
	if (e.painted === void 0 || e.decoded === void 0 || e.dropped === void 0) return !0;
	let t = e.decoded - e.dropped;
	return Math.abs(t - e.painted) <= Math.max(3, e.decoded * .1);
}
function Vt(e) {
	let t = e.wallMs > 0 ? e.mediaS * 1e3 / e.wallMs : 0;
	if (Math.abs(t - e.rate) > e.rate * .1 || e.stalledMs >= 100) return !1;
	let n = Lt(e), r = n === void 0 ? void 0 : n * e.rate;
	if (r !== void 0 && e.maxGapMs !== void 0) {
		let t = Math.max(250, 2500 / Math.min(r, 60));
		if (e.maxGapMs > t) return !1;
	}
	return r === void 0 || r > 50 ? !0 : !Bt(e) && e.painted !== void 0 ? e.painted * 1e3 / e.wallMs >= r * .9 : !e.decoded || (e.dropped ?? 0) <= Math.max(1, e.decoded * .02);
}
function Ht(e) {
	if (e.length < 2) return;
	let t = e.length, n = e.reduce((e, [t]) => e + t, 0) / t, r = e.reduce((e, [, t]) => e + t, 0) / t, i = 0, a = 0;
	for (let [t, o] of e) i += (t - n) * (o - r), a += (t - n) ** 2;
	return a ? i / a : void 0;
}
function Ut(e) {
	let t = 0;
	for (let n = 0; n < e.length; n += 1) t += e.end(n) - e.start(n);
	return t;
}
var z = (e, t) => e === void 0 ? "not measured" : `${I(e)} ${e < t ? "✓" : "✗"}`, Wt = {
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
}, Gt = [
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
function Kt(e) {
	let t = window[e];
	return typeof t == "function" ? t : void 0;
}
function qt(e, t) {
	let n = Kt(e);
	if (n) try {
		return n.isTypeSupported(`video/mp4; codecs="${t}"`);
	} catch {
		return !1;
	}
}
function Jt(e) {
	for (let [t, n] of Object.entries(Wt)) if (qt(e, n.codec)) return {
		name: t,
		sample: n
	};
}
var Yt = (e) => Uint8Array.from(atob(e), (e) => e.charCodeAt(0));
function Xt(e, t) {
	let n = new Uint8Array(e.length + t.length);
	return n.set(e), n.set(t, e.length), n;
}
function Zt(e, t) {
	return new Promise((n, r) => {
		let i = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), n();
		}, a = () => {
			e.removeEventListener("updateend", i), e.removeEventListener("error", a), r(/* @__PURE__ */ Error("append error"));
		};
		e.addEventListener("updateend", i), e.addEventListener("error", a), e.appendBuffer(t);
	});
}
async function Qt(e, t, n, r = 5e3) {
	let i = Kt(e);
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
						await Zt(i, Yt(t.init)), await Zt(i, Xt(Yt(t[n]), Yt(t.mdat)));
					} catch {
						e("append error");
						return;
					}
					if (!i.buffered.length) e("appended, nothing buffered");
					else {
						try {
							s.endOfStream();
						} catch {}
						e(await $t(o, r) ? `plays (${Math.round(performance.now() - a)} ms)` : "buffered, does not play");
					}
				})();
			}, { once: !0 });
		});
		return o.src = c, await e;
	} finally {
		clearTimeout(l), o.removeAttribute("src"), o.load(), o.remove(), URL.revokeObjectURL(c);
	}
}
function $t(e, t) {
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
var en = "0.3.0", tn = [
	"Desktop Chrome, LAN",
	"iPhone app, Wi-Fi (local)",
	"iPhone app, Tailscale",
	"iPhone app, Nabu Casa",
	"Other"
], nn = [
	.5,
	1,
	2,
	4,
	8
], rn = 6e3, an = 1e3, on = 6e4, sn = 3e3, cn = 1e4, ln = 15, un = 7, B = "reolink-viewer-check-running", dn = class extends Error {}, V = (e) => new Promise((t) => setTimeout(t, e)), H = (e) => new Date(e).toLocaleTimeString(), fn = class {
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
		this.running = !0, Tn(this.id, this.options.setup);
		try {
			await this._header(), await this._timelines(), await this._events(), await this._deep(), await this._advance(), await this._rates(), await this._link(), await this._capabilities(), this.options.soakMinutes > 0 && await this._soak(), this._log("Summary:");
			for (let e of this._summary) this._log(`- ${e}`);
		} catch (e) {
			this._log(e instanceof dn ? "Stopped." : `Check failed: ${M(e).message}`);
		} finally {
			this._t.player?.pause(), this.running = !1, this._log(`Done at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}.`), await this._save(!0), En(this.id);
		}
		return this.text;
	}
	_log(e) {
		this.lines.push(e), this._onChange(), performance.now() - this._lastSave > cn && this._save(!1);
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
		if (this._stopped) throw new dn();
	}
	async _wait(e, t) {
		let n = performance.now() + t;
		for (; performance.now() < n;) {
			if (this._checkStopped(), e()) return !0;
			await V(100);
		}
		return e();
	}
	async _pause(e) {
		let t = performance.now() + e;
		for (; performance.now() < t;) this._checkStopped(), await V(Math.min(250, t - performance.now()));
	}
	async _header() {
		let e = this._t, t = navigator.connection;
		this._log(`Reolink Viewer playback check v${en} · ${this.options.setup} · ${e.cameraName} · ${(/* @__PURE__ */ new Date()).toLocaleString()}`), this._log(`Browser: ${Nt(navigator.userAgent)} · page ${Mt(location.hostname)} over ${location.protocol.replace(":", "")} · screen ${screen.width}×${screen.height} @${window.devicePixelRatio}x` + (t?.effectiveType ? ` · network ${t.effectiveType}, ${t.downlink ?? "?"} Mbit/s (browser estimate)` : ""));
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
		this._log(`A1 Time to timeline, today (as the tab opened): ${I(n.timelineMs)} (server: ${wn(n.timelineServer)})`);
		let r = Number(t.slice(8, 10)), i = [...e.monthDays].filter((e) => e < r).sort((e, t) => t - e), a = i.at(Math.min(2, i.length - 1));
		if (a === void 0) {
			this._log("A2/A3 skipped: no earlier recording day this month"), this._summary.push(`Timeline: today ${z(n.timelineMs, 1e3)}`);
			return;
		}
		let o = `${t.slice(0, 8)}${String(a).padStart(2, "0")}`, s = await this._loadDay(o);
		this._log(`A2 Time to timeline, ${o}: ${I(s.timelineMs)} (server: ${wn(s.timelineServer)})`), await this._loadDay(t);
		let c = await this._loadDay(o);
		this._log(`A3 Time to timeline, ${o} again: ${I(c.timelineMs)} (server: ${wn(c.timelineServer)})`);
		let l = await this._loadDay(t);
		this._log(`A4 Time to timeline, today again: ${I(l.timelineMs)} (server: ${wn(l.timelineServer)})`);
		let u = s.timelineServer?.cache === "fresh";
		this._summary.push(`Timeline: today ${z(n.timelineMs, 1e3)}, past day first ${z(s.timelineMs, u ? 3e3 : 1e3)} (${u ? "cold, < 3 s" : "cached, < 1 s"}), again ${z(c.timelineMs, 1e3)}`);
	}
	async _play(e) {
		let t = this._t;
		performance.clearResourceTimings(), performance.setResourceTimingBufferSize(1e3);
		let n = performance.now(), r = xn(t.player, n);
		await t.playAt(e, n);
		let i = await this._wait(() => t.metrics.firstFrameMs !== void 0 || !!t.playFailure, 12e4);
		r.stop();
		let a = t.metrics, o = t.player?.time, s = o === void 0 ? void 0 : o - e, c = s === void 0 || Math.abs(s) <= 2e3 ? "" : ` · STARTED AT ${H(o ?? 0)}, ${R(Math.abs(s))} ${s < 0 ? "before" : "after"} the time asked`, l = t.playing?.file ? ` · ${t.playing.file} file` : "", u = `first frame ${i && !t.playFailure ? I(a.firstFrameMs) : "none"} [URL ${I(a.urlMs)} · metadata ${I(r.seen.loadedmetadata)} · seeked ${I(r.seen.seeked)} · playing ${I(r.seen.playing)}] ${a.delivery ?? "?"}${l} · ${a.stream ?? "?"} ${a.codec ?? ""}${c}${t.playFailure ? ` FAILED: ${t.playFailure}` : ""}`;
		return {
			ok: i && !t.playFailure && !c,
			line: u,
			began: n,
			source: t.playing?.base ?? t.playing?.url
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
			let n = t.segments.find((e) => i.start >= e.start && i.start < e.end), a = n ? `${R(i.start - n.start)} into a ${R(n.end - n.start)} recording` : "no recording", o = await this._play(i.start);
			o.ok && e.metrics.firstFrameMs !== void 0 && r.push(e.metrics.firstFrameMs), this._log(`B  ${i.types.join("+")} at ${H(i.start)} (${a}): ${o.line}`), await V(300), this._log(`     ${Sn(o.began, o.source)}`), n && this._log(`     ${await this._fillReport()}`), await this._pause(1500);
		}
		this._summary.push(`Events → first frame (sub): ${r.map((e) => z(e, 2e3)).join(", ") || "none played"}`);
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
		let e = this._t.playing, t = Ge(e?.base ?? e?.url ?? "");
		if (!t) return "server: nothing played";
		let n = e?.file === "plain", r = null;
		for (let e = 0; e < 90; e += 1) {
			try {
				r = (await Ke(this._t.hass, t)).cache;
			} catch {
				r = null;
			}
			if (!r || r.error || r.complete && (!n || r.flat !== void 0)) break;
			await this._pause(1e3);
		}
		if (!r) return "server: not cached (or its URL expired)";
		let i = [r.cache === "disk" ? "from disk" : `fill (${mn(r.priority)})`];
		for (let [e, t] of [
			["wait_ms", "queue"],
			["headers_ms", "NVR headers"],
			["ttfb_ms", "NVR first byte"],
			["fill_ms", "download"]
		]) typeof r[e] == "number" && i.push(`${t} ${I(r[e])}`);
		return typeof r.mbit_s == "number" && i.push(`${r.mbit_s} Mbit/s`), i.push(L(r.bytes)), r.indexed !== void 0 && i.push(`index ${mn(r.indexed)}`), (n || r.flat !== void 0) && i.push(`plain MP4 ${r.flat === void 0 ? "not yet" : mn(r.flat)}`), typeof r.flat_ms == "number" && i.push(`rewrite ${I(r.flat_ms)}`), typeof r.flat_moov_bytes == "number" && i.push(`moov ${L(r.flat_moov_bytes)}`), r.error && i.push(`error ${r.error}`), `server: ${i.join(", ")}`;
	}
	async _findLong() {
		let e = this._t, t = e.today, n = Number(t.slice(8, 10)), r = [t, ...[...e.monthDays].filter((e) => e < n).sort((e, t) => t - e).slice(0, un).map((e) => `${t.slice(0, 8)}${String(e).padStart(2, "0")}`)], i = 0, a;
		for (let t of r) {
			let n;
			try {
				n = t === e.date && e.day ? e.day : await Ve(e.hass, e.deviceId, t);
			} catch {
				continue;
			}
			for (let e of Ft(n.segments, n.now)) {
				if (i >= ln) return a;
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
		let n = t.segment, r = R(n.end - n.start), i = (e) => `${R(e.time - n.start)} into a ${r} recording of ${t.date}` + (e.event ? ` (event ${e.event.types.join("+")} at ${H(e.event.start)})` : " (no event there: a point)"), a;
		if (t.cached) this._log("D1 skipped: every long recording looked at is cached already (try again after other recordings were viewed)");
		else {
			let r = Pt(n, t.day.events, .5, .95, .75), o = await this._play(r.time);
			o.ok && (a = e.metrics.firstFrameMs), this._log(`D1 Not cached, ${i(r)}: ${o.line}`), await V(300), this._log(`     ${Sn(o.began, o.source)}`), this._log(`     ${await this._fillReport()}`);
		}
		await this._pause(1500);
		let o = Pt(n, t.day.events, .1, .45, .4), s = await this._play(o.time), c = s.ok ? e.metrics.firstFrameMs : void 0;
		this._log(`D2 Cached, ${i(o)}: ${s.line}`), await V(300), this._log(`     ${Sn(s.began, s.source)}`), this._summary.push(`Deep start (sub, ${r} recording): not cached ${a === void 0 ? "not measured" : I(a)}, cached ${z(c, 2e3)}`);
	}
	async _advance() {
		let e = this._t, t = It(e.day?.segments ?? []);
		!t.length && e.date !== e.today && (await this._loadDay(e.today), t = It(e.day?.segments ?? []));
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
			r = t ? o.includes("advanced") ? `yes (preloaded) · gap ${I(e.metrics.gapMs)}` : `yes, by reloading (the next file was not preloaded) · first frame ${I(e.metrics.firstFrameMs)}` : `no: on ${n?.current?.segmentId === i.id ? "the first" : n?.current ? "another" : "no"} recording at ${n?.time === void 0 ? "?" : H(n.time)}, ${n?.paused ? "paused" : "playing"}, next ${n?.preloaded ? "preloaded" : "not preloaded"}, events [${o.join(", ")}]`, this._log(`C  Moved on by itself at ${H(i.end)} (from a ${R(i.end - i.start)} recording): ${r}` + (e.playFailure ? ` FAILED: ${e.playFailure}` : "")), this._summary.push(`Auto-advance: ${t && o.includes("advanced") ? `gap ${I(e.metrics.gapMs)}` : r}`);
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
		this._log(`R  Playback rates, ${R(r.end - r.start)} recording, ${rn / 1e3} s each (sub stream):`);
		let a = [];
		try {
			for (let t of nn) {
				let n = yn(e.player);
				if (!n) break;
				let r = await this._measureRate(n, t);
				if (a.push(r), this._log(`     ${Rt(r)}`), r.ended) break;
			}
		} finally {
			let t = yn(e.player);
			t && (t.playbackRate = 1);
		}
		this._summary.push(`Rates: ${a.map((e) => `${e.rate}× ${Vt(e) ? "✓" : "✗"}`).join(" ") || "not measured"} (smooth = ${zt})`);
	}
	async _measureRate(e, t) {
		e.playbackRate = t;
		let n = e.playbackRate;
		await this._pause(an);
		let r = U(), i = setInterval(() => {
			r &&= U();
		}, 250), a = _n(e), o = e.currentTime, s = performance.now(), c = 0, l, u = 0, d = !1, f = () => {
			c += 1, l ??= performance.now();
		}, p = () => {
			l !== void 0 && (u += performance.now() - l), l = void 0;
		}, m = () => {
			d = !0;
		};
		e.addEventListener("waiting", f), e.addEventListener("playing", p), e.addEventListener("ended", m);
		let h = bn(e);
		try {
			await this._pause(rn);
		} finally {
			clearInterval(i), h.stop(), e.removeEventListener("waiting", f), e.removeEventListener("playing", p), e.removeEventListener("ended", m);
		}
		l !== void 0 && (u += performance.now() - l);
		let g = _n(e);
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
			focused: r && U()
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
		}, sn);
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
			this._log(`L  Link to Home Assistant: ${L(a)} of the cached recording in ${I(s - i)} after the answer = ${c.toFixed(1)} Mbit/s (answer ${I(i)}, HTTP ${r.status})`), this._summary.push(`Link: ${c.toFixed(1)} Mbit/s`);
		} catch (e) {
			this._log(`L  Link test failed: ${M(e).message}`);
		} finally {
			clearTimeout(r);
		}
	}
	async _capabilities() {
		let e = this._t, t = {};
		try {
			t = await Ye(e.hass, e.deviceId);
		} catch {}
		let n = t.sub?.codec, r = t.main?.codec, i = (e) => [["sub", n], ["main", r]].map(([t, n]) => n ? `${t} ${n} ${pn(qt(e, n))}` : `${t} codec unknown (not cached yet)`).join(", "), a = ["MediaSource", "ManagedMediaSource"];
		this._log(`MSE: ${a.map((e) => Kt(e) ? `${e} present (${i(e)})` : `${e} absent`).join(" · ")}`);
		let o = [];
		for (let e of a) {
			if (!Kt(e)) continue;
			let t = Jt(e);
			if (!t) {
				this._log(`MSE probe (${e}): no sample codec supported`);
				continue;
			}
			let n = [];
			for (let { shape: r, label: i } of Gt) this._checkStopped(), n.push(`${i} ${await Qt(e, t.sample, r)}`);
			this._log(`MSE probe (${e}, ${t.name} sample): ${n.join(" · ")}`), o.push(`${e} ${n[0]?.includes("plays") ? "plays MSE-ready fragments" : "fails"}`);
		}
		this._summary.push(`MSE: ${o.join(", ") || "neither MediaSource nor ManagedMediaSource"}`);
		let s = document.createElement("video"), c = (e) => e ? `"${s.canPlayType(`video/mp4; codecs="${e}"`)}"` : "unknown";
		this._log(`Video: canPlayType sub ${c(n)}, main ${c(r)} · getVideoPlaybackQuality ${pn("getVideoPlaybackQuality" in s)} · requestVideoFrameCallback ${pn("requestVideoFrameCallback" in s)} · performance.memory ${pn(hn() !== void 0)}`), this._log(`HD: ${e.hd.reason}`), t.main?.width && t.main.height && r && this._log(`HD decodingInfo for ${r} at ${t.main.width}×${t.main.height}: ${await Cn(r, t.main.width, t.main.height)}`), this._summary.push(`HD: ${e.hd.main ? "offered" : "not offered"} (${e.hd.reason})`);
	}
	async _soak() {
		let e = this._t, t = this.options.soakMinutes, n = this._long, r = n?.date ?? e.date;
		e.date !== r && await this._loadDay(r);
		let i = n?.segment ?? e.day?.segments[0];
		if (!i) {
			this._log("M  skipped: no recording to play");
			return;
		}
		this._log(`M  One-hour session: playing from ${H(i.start)} on ${r} for ${t} min, a sample a minute`);
		let a = e.player, o = 0, s = 0, c = [], l = () => {
			o += 1;
		}, u = (e) => {
			s += 1, c.push(e.detail.gapMs);
		}, d = [...a?.renderRoot.querySelectorAll("video") ?? []], f = [], p = [], m = 0, h = new gn(), g = { minute: !0 }, ee = setInterval(() => {
			g.minute &&= U();
		}, 1e3), te = performance.now();
		try {
			await this._play(i.start), d.forEach((e) => {
				e.addEventListener("waiting", l);
			}), a?.addEventListener("rv-advanced", u);
			for (let n = 1; n <= t; n += 1) {
				if (await this._pause(on), e.player?.paused && document.visibilityState === "visible") {
					let t = e.day?.segments[0];
					this._log(`M  ${n} min: playback had stopped${e.playFailure ? ` (${e.playFailure})` : ""}; starting again from the day's first recording`), t && await e.playAt(t.start, performance.now());
				}
				let t = yn(e.player), r = h.update(d), i = g.minute && U();
				g.minute = !0;
				let a = t ? Math.max(0, vn(t) - t.currentTime) : 0;
				m = Math.max(m, a);
				let c = hn();
				c !== void 0 && f.push([(performance.now() - te) / 36e5, c]);
				let l = await this._stats();
				l?.vod.disk_bytes !== void 0 && p.push(l.vod.disk_bytes);
				let u = d.reduce((e, t) => e + Ut(t.buffered), 0);
				this._log(`M  ${n} min: ${e.player?.time === void 0 ? "?" : H(e.player.time)} ${e.player?.paused ? "paused" : "playing"}` + (document.visibilityState === "visible" ? "" : " (page hidden: the system pauses video)") + (i ? "" : " · PAGE NOT IN FRONT this minute") + ` · heap ${c === void 0 ? "n/a" : L(c)} · ${a.toFixed(0)} s ahead, ${u.toFixed(0)} s buffered in both videos · dropped ${r} this minute, ${h.dropped} of ${h.decoded} in all · ${o} stalls · ${s} file changes` + (e.metrics.recoveries ? ` · ${e.metrics.recoveries} reloads mid-way` : "") + (l ? ` · cache ${L(l.vod.disk_bytes)} on disk + ${L(l.vod.reserved_bytes)} reserved, ${l.vod.leased ?? "?"} leased` : "")), Tn(this.id, this.options.setup, n);
			}
		} finally {
			clearInterval(ee), d.forEach((e) => {
				e.removeEventListener("waiting", l);
			}), a?.removeEventListener("rv-advanced", u);
		}
		let _ = Ht(f), v = f.length ? `heap ${L(f[0]?.[1])} → ${L(f.at(-1)?.[1])} (max ${L(Math.max(...f.map(([, e]) => e)))}${_ === void 0 ? "" : `, ${_ >= 0 ? "+" : ""}${L(_)}/h`})` : "heap not measurable in this browser (the page was not reloaded)", ne = (await this._stats())?.vod.max_bytes, re = p.length ? `cache ${L(Math.min(...p))}–${L(Math.max(...p))} on disk (cap ${L(ne)})` : "cache use unknown", y = `${t} min: ${v}, at most ${m.toFixed(0)} s buffered ahead, ${h.dropped} of ${h.decoded} frames dropped, ${o} stalls, ${s} file changes${c.length ? ` (gaps ${c.map((e) => I(e)).join(", ")})` : ""}, ${e.metrics.recoveries ?? 0} reloads mid-way, ${re}`;
		this._log(`M  Summary: ${y}`), this._summary.push(`Session: ${y}`);
	}
	async _stats() {
		try {
			return await this._t.hass.callWS({ type: "reolink_viewer/playback/stats" });
		} catch {
			return;
		}
	}
}, pn = (e) => e === void 0 ? "n/a" : e ? "yes" : "no", U = () => document.visibilityState === "visible" && document.hasFocus(), mn = (e) => typeof e == "string" || typeof e == "number" ? String(e) : "?";
function hn() {
	return performance.memory?.usedJSHeapSize;
}
var gn = class {
	decoded = 0;
	dropped = 0;
	_last = /* @__PURE__ */ new Map();
	update(e) {
		let t = this.dropped;
		for (let t of e) {
			let e = _n(t);
			if (!e) continue;
			let n = this._last.get(t), r = !n || e.totalVideoFrames < n.totalVideoFrames;
			this.decoded += r ? e.totalVideoFrames : e.totalVideoFrames - n.totalVideoFrames, this.dropped += r ? e.droppedVideoFrames : e.droppedVideoFrames - n.droppedVideoFrames, this._last.set(t, e);
		}
		return this.dropped - t;
	}
};
function _n(e) {
	return typeof e.getVideoPlaybackQuality == "function" ? e.getVideoPlaybackQuality() : void 0;
}
function vn(e) {
	let t = e.buffered;
	for (let n = 0; n < t.length; n += 1) if (t.start(n) <= e.currentTime + .5 && t.end(n) >= e.currentTime) return t.end(n);
	return e.currentTime;
}
function yn(e) {
	return e?.renderRoot.querySelector("video.active") ?? null;
}
function bn(e) {
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
function xn(e, t) {
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
function Sn(e, t) {
	let n = t ? new URL(t, location.href).pathname : "", r = performance.getEntriesByType("resource").filter((t) => (t.initiatorType === "video" || t.initiatorType === "fetch" && t.name.includes("/api/reolink_viewer/mse/")) && t.startTime >= e - 5);
	if (!r.length) return "requests: none reported (this browser may not report video requests)";
	let i = r.filter((e) => e.requestStart > 0), a = i.slice(0, 10).map((t, r) => {
		let i = n && new URL(t.name).pathname.startsWith(n) ? "" : " (other file)", a = t.encodedBodySize ? ` · ${L(t.encodedBodySize)}` : "";
		return `#${r + 1}${i} +${Math.round(t.startTime - e)} ms: wait ${Math.round(t.requestStart - t.startTime)} · answer ${Math.round(t.responseStart - t.requestStart)} · ran ${Math.round(t.responseEnd - t.responseStart)} ms${a}`;
	}), o = i.length > 10 ? ` | … ${i.length - 10} more` : "", s = r.length - i.length, c = [...new Set(i.map((e) => e.nextHopProtocol).filter(Boolean))].join("/");
	return `requests${c ? ` (${c})` : ""}: ${i.length} sent${s ? `, ${s} cancelled before sending` : ""}: ${a.join(" | ")}${o}`;
}
async function Cn(e, t, n) {
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
		i.push(`${a}: ${M(e).message}`);
	}
	return i.join(" · ");
}
function wn(e) {
	if (!e) return "?";
	let t = [e.cache ?? "?"];
	e.age_s !== void 0 && t.push(`${mn(e.age_s)} s old`);
	for (let [n, r] of [
		["queue_ms", "queue"],
		["files_ms", "recordings"],
		["events_ms", "events"],
		["total_ms", "total"]
	]) {
		let i = e[n];
		typeof i == "number" && t.push(`${r} ${I(i)}`);
	}
	return typeof e.warm == "string" && t.push(`background fetch: ${e.warm}`), t.join(", ");
}
function W() {
	try {
		return window.localStorage;
	} catch {
		return;
	}
}
function Tn(e, t, n) {
	try {
		let r = W()?.getItem(B), i = {
			id: e,
			setup: t,
			started: r ? JSON.parse(r).started : (/* @__PURE__ */ new Date()).toISOString(),
			updated: (/* @__PURE__ */ new Date()).toISOString(),
			...n ? { minute: n } : {}
		};
		W()?.setItem(B, JSON.stringify(i));
	} catch {}
}
function En(e) {
	try {
		let t = W()?.getItem(B);
		t && JSON.parse(t).id === e && W()?.removeItem(B);
	} catch {}
}
async function Dn(e) {
	let t;
	try {
		let e = W()?.getItem(B);
		if (!e) return;
		t = JSON.parse(e), W()?.removeItem(B);
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
var On = (e) => e.callWS({ type: "reolink_viewer/playback/check_reports" });
//#endregion
//#region src/playback/codec.ts
function kn() {
	let e = navigator.mediaCapabilities, t = e?.decodingInfo;
	return t ? t.bind(e) : void 0;
}
async function An(e, t = kn()) {
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
function jn(e = navigator.userAgent) {
	return !(/AppleWebKit/.test(e) && !/Chrome|Chromium|CriOS|Edg|Android|FxiOS/.test(e));
}
//#endregion
//#region src/playback/timeline-math.ts
var G = 6e4, K = 60 * G, Mn = 24 * K, q = [
	Mn,
	6 * K,
	K,
	15 * G,
	5 * G
];
function Nn(e, t, n) {
	return (e - t.start) / t.span * n;
}
function Pn(e, t, n) {
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
function Fn(e, t, n, r) {
	return J({
		start: n - (n - e.start) / e.span * t,
		span: t
	}, r);
}
function In(e) {
	let t = 0;
	return q.forEach((n, r) => {
		Math.abs(n - e) < Math.abs((q[t] ?? n) - e) && (t = r);
	}), t;
}
function Ln(e, t, n) {
	return J({
		start: t - e.span / 2,
		span: e.span
	}, n);
}
var Rn = [
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
function zn(e, t, n = 60) {
	for (let r of Rn) if (r / e.span * t >= n) return r;
	return Rn[Rn.length - 1] ?? 36e5;
}
function Bn(e, t, n) {
	let r = zn(e, t), i = [], a = e.start + e.span, o = n(e.start), s = Math.ceil((e.start + o) / r) * r - o;
	for (let e = 0; s <= a && e < 500; e += 1) i.push(s), s += r;
	return i;
}
function Vn(e, t, n, r = 1) {
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
function Hn(e, t) {
	let n = 0, r = e.length - 1, i;
	for (; n <= r;) {
		let a = n + r >> 1, o = e.at(a);
		if (!o) break;
		o.start <= t ? (t < o.end && (i = o), n = a + 1) : r = a - 1;
	}
	return i;
}
function Un(e, t) {
	return e.find((e) => e.start > t);
}
function Wn(e, t) {
	let n = Hn(e, t);
	if (n) return {
		segment: n,
		offset: t - n.start
	};
	let r = Un(e, t);
	return r ? {
		segment: r,
		offset: 0
	} : void 0;
}
function Gn(e, t) {
	return t.size === 0 ? e : e.filter((e) => e.types.some((e) => !t.has(e)));
}
function Kn(e, t) {
	return e.find((e) => e.start > t + 500);
}
function qn(e, t) {
	let n;
	for (let r of e) if (r.start < t - 1500) n = r;
	else break;
	return n;
}
var Jn = [
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
], Y = new Map(Jn.map((e, t) => [e.type, t]));
function Yn(e) {
	let t;
	for (let n of e) (t === void 0 || (Y.get(n) ?? 99) < (Y.get(t) ?? 99)) && (t = n);
	return t ?? "MOTION";
}
function Xn(e) {
	return Jn[Y.get(e) ?? -1]?.color ?? "#9e9e9e";
}
function Zn(e) {
	return Jn[Y.get(e) ?? -1]?.label ?? e.toLowerCase();
}
function Qn(e) {
	return [...new Set(e.flatMap((e) => e.types))].sort((e, t) => (Y.get(e) ?? 99) - (Y.get(t) ?? 99));
}
function $n(e) {
	return e >= 216e5 ? 300 : e >= 36e5 ? 60 : e >= 9e5 ? 10 : 5;
}
function er(e, t, n) {
	let r = new Date(Date.UTC(e, t - 1, 1)).getUTCDay(), i = new Date(Date.UTC(e, t, 0)).getUTCDate(), a = (r - n % 7 + 7) % 7, o = [...Array.from({ length: a }, () => null), ...Array.from({ length: i }, (e, t) => t + 1)];
	for (; o.length % 7;) o.push(null);
	let s = [];
	for (let e = 0; e < o.length; e += 7) s.push(o.slice(e, e + 7));
	return s;
}
function tr(e, t, n) {
	let r = e * 12 + (t - 1) + n;
	return [Math.floor(r / 12), r % 12 + 1];
}
function nr(e, t, n) {
	return `${String(e).padStart(4, "0")}-${String(t).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
//#endregion
//#region src/playback/calendar.ts
var rr = [
	0,
	1,
	2,
	3,
	4,
	5,
	6
], ir = class extends j {
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
		let [t, n] = tr(this.year, this.month, e);
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
		}), t = rr.map((e) => (e + this.firstDay) % 7).map((e) => new Date(Date.UTC(2023, 0, 1 + e)).toLocaleDateString(void 0, {
			weekday: "narrow",
			timeZone: "UTC"
		})), [n, r] = tr(this.year, this.month, 1), i = this.today !== void 0 && nr(n, r, 1) > this.today;
		return E`<div class="head">
        <button class="text" aria-label="Previous month" @click=${() => {
			this._move(-1);
		}}>‹</button>
        <span class="title">${e}${this.loading ? E` <span class="muted small">…</span>` : O}</span>
        <button class="text" aria-label="Next month" ?disabled=${i} @click=${() => {
			this._move(1);
		}}>›</button>
      </div>
      <div class="grid" role="grid">
        ${t.map((e) => E`<span class="dow" role="columnheader">${e}</span>`)}
        ${er(this.year, this.month, this.firstDay).flat().map((e) => {
			if (e === null) return E`<span></span>`;
			let t = nr(this.year, this.month, e), n = this.today !== void 0 && t > this.today, r = this.days.has(e);
			return E`<button
              role="gridcell"
              class="day ${t === this.selected ? "selected" : ""} ${t === this.today ? "today" : ""}"
              ?disabled=${n}
              aria-pressed=${t === this.selected ? "true" : "false"}
              aria-label="${t}${r ? ", has recordings" : ""}"
              @click=${() => {
				this._emit("rv-day", { date: t });
			}}
            >
              ${e}${r ? E`<span class="dot"></span>` : O}
            </button>`;
		})}
      </div>`;
	}
	static styles = [N, o`
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
customElements.get("rv-calendar") || customElements.define("rv-calendar", ir);
//#endregion
//#region src/playback/time.ts
var ar = /* @__PURE__ */ new Map();
function or(e, t) {
	let n = `${e ?? ""}|${JSON.stringify(t)}`, r = ar.get(n);
	if (!r) {
		try {
			r = new Intl.DateTimeFormat(void 0, {
				...t,
				...e ? { timeZone: e } : {}
			});
		} catch {
			r = new Intl.DateTimeFormat(void 0, t);
		}
		ar.set(n, r);
	}
	return r;
}
function X(e, t, n = !1) {
	return or(t, {
		hour: "2-digit",
		minute: "2-digit",
		...n ? { second: "2-digit" } : {},
		hourCycle: "h23"
	}).format(e);
}
function sr(e, t) {
	return or(t, {
		weekday: "short",
		month: "short",
		day: "numeric"
	}).format(e);
}
function cr(e) {
	let t = Math.max(0, Math.round(e / 1e3)), n = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60), i = t % 60;
	return n ? `${n} h ${String(r).padStart(2, "0")} min` : r ? `${r} min ${String(i).padStart(2, "0")} s` : `${i} s`;
}
function lr(e, t) {
	let n = or(t, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).formatToParts(e), r = (e) => n.find((t) => t.type === e)?.value ?? "";
	return `${r("year")}-${r("month")}-${r("day")}`;
}
function ur(e, t) {
	let n = or(t, {
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
function dr(e) {
	try {
		let t = new Intl.Locale(e ?? navigator.language), n = t.getWeekInfo?.() ?? t.weekInfo;
		if (n) return n.firstDay % 7;
	} catch {}
	return +!/^en-(US|CA)|^ja|^he/.test(e ?? navigator.language);
}
var fr = class extends j {
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
		let t = Yn(e.types), n = this.thumbs.get(e.start);
		return E`<li>
      <button
        class="card ${this.current !== void 0 && this.current >= e.start && this.current < e.end ? "active" : ""}"
        aria-label="${e.types.map(Zn).join(", ")} at ${X(e.start, this.timeZone, !0)}"
        @click=${() => {
			this.dispatchEvent(new CustomEvent("rv-pick", {
				detail: { event: e },
				bubbles: !0,
				composed: !0
			}));
		}}
      >
        <span class="thumb" style="border-color: ${Xn(t)}">
          ${n ? E`<img src=${n} alt="" loading="lazy" decoding="async" />` : O}
        </span>
        <span class="meta">
          <span class="types">
            ${e.types.map((e) => E`<span class="badge" style="background: ${Xn(e)}; color: white">${Zn(e)}</span>`)}
          </span>
          <span class="when">
            ${X(e.start, this.timeZone, !0)}
            <span class="muted">· ${cr(e.end - e.start)}</span>
            ${e.ambiguous ? E`<span class="muted" title="Recorded in the hour repeated when clocks went back"> · time ±1 h</span>` : O}
          </span>
        </span>
      </button>
    </li>`;
	}
	render() {
		if (!this.events.length) return E`<p class="muted">No events for the selected filters.</p>`;
		let e = this.events.length - this._shown;
		return E`<ul>
        ${this.visible.map((e) => this._card(e))}
      </ul>
      ${e > 0 ? E`<button class="more" @click=${() => {
			this._shown += 60;
		}}>Show ${Math.min(e, 60)} more (${e} left)</button>` : O}`;
	}
	static styles = [N, o`
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
customElements.get("rv-event-list") || customElements.define("rv-event-list", fr);
//#endregion
//#region src/playback/mse-feeder.ts
var Z = class extends Error {}, pr = 4e3, mr = 2e4, hr = 12e4, gr = 16777216, _r = 50331648, vr = 1e3;
function Q() {
	let e = window;
	if (typeof e.ManagedMediaSource == "function") return "ManagedMediaSource";
	if (typeof e.MediaSource == "function") return "MediaSource";
}
function yr(e) {
	return window[e];
}
function br(e) {
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
function xr(e, t) {
	let n = Math.min(30 * Math.max(1, e), 240);
	return t > 0 ? Math.max(4, Math.min(n, _r / t)) : n;
}
function Sr(e) {
	return e instanceof DOMException && e.name === "QuotaExceededError";
}
var Cr = class {
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
		let t = Q();
		if (!t) throw new Z("this browser has no MediaSource");
		this.stats.api = t;
		let n = yr(t), r = new n();
		this._source = r, this._video.disableRemotePlayback = !0, this._url = URL.createObjectURL(r);
		let i = new Promise((e) => {
			r.addEventListener("sourceopen", () => {
				e();
			}, { once: !0 });
		});
		if (this._video.src = this._url, await i, this._gone()) return;
		let a = await this._get("init"), o = a.headers.get("X-RV-Mime") ?? "";
		if (this.stats.mime = o, !o || !n.isTypeSupported(o)) throw new Z(`MSE cannot play ${o || "this recording"}`);
		let s = new Uint8Array(await a.arrayBuffer());
		if (!this._gone()) {
			this._buffer = r.addSourceBuffer(o), this._src.durationMs > 0 && (r.duration = this._src.durationMs / 1e3);
			for (let e of [
				"timeupdate",
				"seeking",
				"ratechange",
				"progress"
			]) this._listen(this._video, e, this._pump);
			this._listen(this._video, "waiting", this._jumpGap), this._listen(r, "startstreaming", this._pump), this._listen(this._buffer, "updateend", this._pump), this._listen(this._buffer, "bufferedchange", this._pump), await this._append(s), await this._fetch({ at: e }, pr, !0), e > 0 && this._video.currentTime === 0 && (this._video.currentTime = e / 1e3), this._ready = !0, this._pump();
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
			throw e.startsWith("not playable as fragments") ? new Z(e) : Error(`HTTP ${n.status}${e ? `: ${e}` : ""}`);
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
			e && n !== void 0 && t >= n - .5 && t < e.atS + .5 ? this._fetch({ first: e.index }, pr, !1) : this._fetch({ at: t * 1e3 }, pr, !1);
			return;
		}
		if (this._trim(t, n)) return;
		if (this._endS !== void 0 && n.end >= this._endS - .5) {
			this._endOfStream();
			return;
		}
		if (this._source?.streaming === !1 || n.end - t >= xr(this._video.playbackRate, this._bytesPerSecond)) return;
		let i = this._next, a = i && Math.abs(i.atS - n.end) < .5 ? { first: i.index } : { at: n.end * 1e3 }, o = Math.min(mr * Math.max(1, this._video.playbackRate), hr);
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
			let n = await this._get(`frags?${o}&ms=${Math.round(t)}&bytes=${gr}`, r.signal), i = new Uint8Array(await n.arrayBuffer());
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
			}, d > u && (this._bytesPerSecond = i.length * 1e3 / (d - u))), n.headers.get("X-RV-Last") === "1") this._endS = l > 0 ? d / 1e3 : this._video.duration, this._endOfStream();
			else if (l === 0) {
				this._settle(r), setTimeout(this._pump, vr);
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
				if (!Sr(n)) throw n;
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
				e.removeEventListener("updateend", r), n(new Z("append error"));
			};
			e.addEventListener("updateend", r, { once: !0 }), e.addEventListener("error", i, { once: !0 });
		}) : Promise.resolve();
	}
	async _removeAllBut(e, t) {
		let n = this._video.currentTime;
		for (let r of br(e.buffered)) {
			let i = Math.max(r.start, n - t), a = Math.min(r.end, n + t);
			a <= i ? (e.remove(r.start, r.end), await this._idle(e)) : (i > r.start && (e.remove(r.start, i), await this._idle(e)), r.end > a && (e.remove(a, r.end), await this._idle(e)));
		}
		this.stats.trims += 1;
	}
	_trim(e, t) {
		let n = this._buffer;
		if (!n) return !1;
		for (let r of br(n.buffered)) if (r.start !== t.start && (r.end < e - 30 || r.start > e + 240)) return n.remove(r.start, r.end), this.stats.trims += 1, !0;
		return e - t.start > 40 && (n.remove(t.start, e - 30), this.stats.trims += 1, !0);
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
		if (t) return br(t.buffered).find((t) => e >= t.start - .05 && e < t.end);
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
}, wr = [
	.5,
	1,
	2,
	4,
	8
], Tr = class extends j {
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
		a && (this._pendingOffset[i] = t, r ? this._seekTo(a, t) : (this._items[i] = e, this._load(i, a, e, t)), this._start(a), this.requestUpdate());
	}
	async preload(e) {
		await this.updateComplete;
		let t = this._other, n = this._video(t);
		n && this._items[t]?.recording !== e?.recording && (this._items[t] = e, this._pendingOffset[t] = 0, n.pause(), e ? (n.preload = "auto", this._load(t, n, e, 0)) : this._unload(t, n));
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
			t?.pause(), t && this._unload(e, t), this._items[e] = void 0;
		}
		this._paused = !0, this._waiting = !1;
	}
	_load(e, t, n, r) {
		if (this._feeders[e]?.destroy(), this._feeders[e] = void 0, this._keys[e] = n.key, n.mse) {
			let i = new Cr(t, n.mse, (t) => {
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
			this._items[e] = void 0;
			let t = this._video(e);
			t && this._unload(e, t);
			return;
		}
		let r = this._video(e);
		r && this._fail(n.message, r, n instanceof Z);
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
			this._items[e] = void 0;
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
			this._items[e] = void 0;
			return;
		}
		let r = this._feeders[e] !== void 0;
		this._fail(n.error?.message || `media error ${n.error?.code ?? "?"}`, n, r);
	}
	_renderVideo(e) {
		return E`<video
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
		return E`<div class="frame">
      ${this._renderVideo(0)}${this._renderVideo(1)}
      ${e ? E`<div class="note" role="status">${e}</div>` : O}
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
customElements.get("rv-player") || customElements.define("rv-player", Tr);
//#endregion
//#region src/playback/thumb-loader.ts
var Er = class {
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
}, Dr = 4, $ = 76, Or = 18, kr = 22, Ar = 26, jr = 52, Mr = 16, Nr = class extends j {
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
		return Pn(e, this.view, this._width || 1);
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
		let n = q[Math.min(Math.max(In(this.view.span) + e, 0), q.length - 1)] ?? this.view.span, r = t ?? this.cursor ?? this.view.start + this.view.span / 2;
		this._setView(Fn(this.view, n, r, this._bounds));
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
		}, Pr(this._canvas, e.pointerId, !0));
	}
	_onPointerMove(e) {
		let t = this._x(e), n = this._drag;
		if (n && n.pointerId === e.pointerId) {
			if (Math.abs(t - n.x) > Dr && (n.moved = !0), n.moved) {
				let e = this.timeAt(t);
				this._emit("rv-scrub", { time: e }), this._scheduleHover(e, t);
			}
		} else e.pointerType === "mouse" && this._scheduleHover(this.timeAt(t), t);
	}
	_onPointerUp(e) {
		let t = this._drag;
		t && t.pointerId === e.pointerId && (this._drag = void 0, Pr(this._canvas, e.pointerId, !1), this._emit("rv-seek", { time: this.timeAt(this._x(e)) }), e.pointerType !== "mouse" && this._endHover());
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
		let l = this.view, u = (e) => Nn(e, l, t);
		r.font = "11px sans-serif", r.textBaseline = "top", r.fillStyle = o, r.strokeStyle = s, r.lineWidth = 1;
		let d = this.timeZone, f = zn(l, t) < G;
		for (let e of Bn(l, t, (e) => ur(e, d))) {
			let n = Math.round(u(e)) + .5;
			r.beginPath(), r.moveTo(n, 14), r.lineTo(n, $), r.stroke();
			let i = X(e, d, f);
			n + 3 + r.measureText(i).width <= t && r.fillText(i, n + 3, 2);
		}
		let p = this.day;
		if (p) {
			if (p.now < p.end) {
				r.fillStyle = a("--secondary-background-color", "#f2f2f2");
				let e = Math.max(0, u(p.now));
				r.fillRect(e, kr, t - e, 54);
			}
			r.globalAlpha = .85, r.fillStyle = c;
			for (let e of Vn(p.segments, l, t)) {
				let n = Math.max(0, u(e.start)), i = Math.min(t, u(e.end));
				r.fillRect(n, kr, Math.max(1, i - n), Ar);
			}
			r.globalAlpha = 1;
			for (let e of this.events) {
				if (e.end < l.start || e.start > l.start + l.span) continue;
				let t = u(e.start), n = Math.max(3, u(e.end) - t);
				r.fillStyle = Xn(Yn(e.types)), r.fillRect(t, jr, n, Mr);
			}
		}
		if (this.cursor !== void 0) {
			let e = Math.round(u(this.cursor)) + .5;
			r.strokeStyle = a("--accent-color", "#ff9800"), r.lineWidth = 2, r.beginPath(), r.moveTo(e, Or), r.lineTo(e, $), r.stroke();
		}
	}
	render() {
		return E`<canvas
      role="slider"
      tabindex="0"
      aria-label="Recording timeline"
      aria-valuemin=${this.day?.start ?? 0}
      aria-valuemax=${this.day?.end ?? 0}
      aria-valuenow=${this.cursor ?? 0}
      aria-valuetext=${this.cursor === void 0 ? "no position" : X(this.cursor, this.timeZone, !0)}
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
function Pr(e, t, n) {
	try {
		n ? e?.setPointerCapture(t) : e?.releasePointerCapture(t);
	} catch {}
}
customElements.get("rv-timeline") || customElements.define("rv-timeline", Nr);
//#endregion
//#region src/components/playback.ts
var Fr = 6e4, Ir = 1e4, Lr = 86400, Rr = 10 * G, zr = 10, Br = 8e3, Vr = 3 * G, Hr = 1e3, Ur = 6e4, Wr = "reolink-viewer-check-setup", Gr = "reolink-viewer-player", Kr = !1, qr = class extends j {
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
	thumbLoader = new Er();
	_thumbPause;
	_eventsRetry;
	_eventsRetries = 0;
	_refreshTimer;
	_lastCursorPaint = 0;
	_progressive = jn();
	_check;
	_starting;
	_preloadPending;
	_recoveredAt = -Infinity;
	_mseFailed = /* @__PURE__ */ new Set();
	_lastPreview = 0;
	constructor() {
		super(), this.deviceId = "", this.cameraName = "", this._date = "", this._loading = !1, this._view = {
			start: 0,
			span: Mn
		}, this._hidden = /* @__PURE__ */ new Set();
		let e = /* @__PURE__ */ new Date();
		this._month = {
			year: e.getFullYear(),
			month: e.getMonth() + 1
		}, this._monthDays = /* @__PURE__ */ new Set(), this._monthLoading = !1, this._stream = "sub", this._hd = {
			main: !1,
			reason: "checking…"
		}, this._thumbs = /* @__PURE__ */ new Map(), this._metrics = {}, this._checkText = "", this._checkRunning = !1, this._checkSetup = $r(), this._checkSession = !1, this._rate = 1, this._mode = ei();
	}
	get _zone() {
		return this.hass?.config?.time_zone;
	}
	get _today() {
		return lr(Date.now(), this._zone);
	}
	get _player() {
		return this.renderRoot.querySelector("rv-player");
	}
	get _timeline() {
		return this.renderRoot.querySelector("rv-timeline");
	}
	get _events() {
		return Gn(this._day?.events ?? [], this._hidden);
	}
	connectedCallback() {
		super.connectedCallback(), this._refreshTimer = setInterval(() => {
			this._date === this._today && document.visibilityState !== "hidden" && this._loadDay(this._date, {
				keepView: !0,
				quiet: !0
			});
		}, Fr);
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
			}), this._loadDay(this._date), this._loadMonth(this._month.year, this._month.month), this._checkHd(), Kr || (Kr = !0, Dn(this.hass).then((e) => {
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
			let o = await Ve(n, this.deviceId, e, t.quiet ? 0 : Lr);
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
			}), this._warmLongRecording(o), a = !t.quiet && o.timing.cache === "stale", this._retryEventsSoon(o);
		} catch (e) {
			r === this._daySeq && (this._error = M(e).message);
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
		}, Ir));
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
			let i = await Be(n, this.deviceId, e, t);
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
			let t = await Ye(e, this.deviceId);
			this._hd = await An(t.main), this._metrics = {
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
		let t = this.hass, n = this._cursor === void 0 ? e.segments.at(-1) : Hn(e.segments, this._cursor);
		!t || !n || n.end - n.start < Rr || qe(t, this._ref(n)).catch(() => void 0);
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
		let i = Wn(r.segments, e);
		if (!i) {
			F(this, "No recording after this time on this day");
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
			let e = this._useMse(this._stream), r = this._progressive && i.offset < 3e3, c = this._ref(i.segment), l = e ? await We(n, c, o) : await Ue(n, c, r, o);
			if (a !== this._playSeq) return;
			this._playing = l, this._metrics = {
				...this._metrics,
				urlMs: performance.now() - s,
				firstFrameMs: void 0,
				gapMs: void 0,
				stream: l.stream,
				cache: l.cache,
				codec: l.media?.codec ?? null,
				delivery: e ? `MSE (${Q() ?? "?"})${l.cache.complete ? ", cached" : ""}` : Zr(r, this._progressive, l.cache.complete)
			};
			let u = Math.max(0, o - l.start);
			await this._player?.play(this._toItem(l), u, t), this._showDownload(l, a), this._schedulePreload(i.segment, a, o);
		} catch (e) {
			a === this._playSeq && this._playError(M(e).message);
		} finally {
			this._starting === a && (this._starting = void 0);
		}
	}
	_seekWithin(e, t, n) {
		let r = this._player, i = r?.current;
		return !r?.mse || !this._useMse(this._stream) || !i || i.segmentId !== e.id || this._playing?.stream !== this._stream || i.end < e.end && t > i.end - Ur ? !1 : (this._metrics = {
			...this._metrics,
			urlMs: 0,
			firstFrameMs: void 0,
			delivery: `MSE (${Q() ?? "?"}), same recording`
		}, r.seekWithin(Math.max(0, t - i.start), n), !0);
	}
	_describeMode() {
		let e = Q();
		if (this._mode === "file") return "file player only (Debug setting)";
		if (!e) return "file player (this browser has no MSE)";
		if (typeof this.hass?.fetchWithAuth != "function") return "file player (no authenticated fetch)";
		let t = [...this._mseFailed];
		return `MSE (${e})${t.length ? `, file player for ${t.join(", ")} after a failure` : ""}`;
	}
	_useMse(e) {
		return this._mode === "auto" && Q() !== void 0 && typeof this.hass?.fetchWithAuth == "function" && !this._mseFailed.has(e);
	}
	_toItem(e) {
		let t = {
			recording: `${e.stream}:${e.segment_id}:${e.end}`,
			segmentId: e.segment_id,
			start: e.start,
			end: e.end
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
		let n = this.hass, r = Ge(e.base ?? e.url ?? "");
		if (!n || !r || e.cache.complete) return;
		let i = () => t === this._playSeq && this._metrics.firstFrameMs === void 0 && !this._playFailure;
		for (; i() && (await Jr(Hr), i());) try {
			let t = await Ke(n, r);
			if (!i() || !t.cache || t.cache.complete || t.cache.error) break;
			let a = e.stream === "main" ? "HD " : "";
			this._note = `Fetching the ${a}recording from the recorder: ${Yr(t.cache.bytes)} of about ${Yr(t.expected_bytes)}`;
		} catch {
			break;
		}
		t === this._playSeq && (this._note = void 0);
	}
	_schedulePreload(e, t, n) {
		this._preloadPending = void 0;
		let r = this.hass, i = this._nextSegment(e);
		!r || !i || e.end - n <= Vr ? this._preloadAfter(e, t) : (this._player?.preload(void 0), qe(r, this._ref(i)).catch(() => void 0), this._preloadPending = {
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
			let e = this._ref(r), i = this._useMse(this._stream) ? await We(n, e, r.start) : await Ue(n, e, this._progressive, r.start);
			if (t !== this._playSeq) return;
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
		}, Br);
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
		this._resumeThumbs(), this._stream === "main" ? (this._stream = "sub", F(this, `HD failed (${e}); back to the sub stream`, "error"), this._cursor !== void 0 && this.playAt(this._cursor)) : (this._playFailure = e, F(this, `Playback failed: ${e}`, "error"));
	}
	_onTime(e) {
		if (this._starting !== void 0) return;
		let t = performance.now();
		if (t - this._lastCursorPaint < 250) return;
		this._lastCursorPaint = t;
		let n = this._preloadPending;
		n && n.seq === this._playSeq && n.segment.end - e <= Vr && (this._preloadPending = void 0, this._preloadAfter(n.segment, n.seq)), this._cursor = e, (e > this._view.start + this._view.span || e < this._view.start) && (this._view = Ln(this._view, e, this._day ?? {
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
		let t = this._cursor ?? this._view.start, n = e > 0 ? Kn(this._events, t) : qn(this._events, t);
		n ? (this._cursor = n.start, this._day && (this._view = Ln(this._view, n.start, this._day)), this.playAt(n.start)) : F(this, e > 0 ? "No later event" : "No earlier event");
	}
	_setRate(e) {
		this._rate = e;
	}
	_setMode(e) {
		this._mode = e, this._mseFailed.clear(), ti(e);
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
		if (!t || !this._day || !Hn(this._day.segments, e.time)) {
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
			let i = (await Je(t, this.deviceId, [e.time], $n(this._view.span))).urls[0]?.url;
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
				let e = await Je(t, this.deviceId, n, zr), r = this._date;
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
		let t = new fn(this._checkTarget(), e, () => {
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
			this._reports = (await On(this.hass)).reports;
		} catch (e) {
			F(this, `Could not load the reports: ${M(e).message}`, "error");
		}
	}
	async _copy(e) {
		await ri(e) ? F(this, "Report copied") : F(this, "Copying is blocked here: select the report text and copy it", "error");
	}
	_renderCheck() {
		let e = this._checkRunning;
		return E`<div class="check">
      <strong>Playback check</strong>
      <p class="small muted">
        Measures this device: timeline, first frames (events, deep in long recordings, cached and not), auto-advance,
        playback rates, the link, MSE support and HD. The report is saved on the server, so a run on a phone can be
        copied on a desktop.
      </p>
      ${this._checkNote ? E`<div class="banner error" role="alert">${this._checkNote}</div>` : O}
      <div class="row">
        <label
          >Setup
          <select
            ?disabled=${e}
            @change=${(e) => {
			this._checkSetup = e.target.value, ni(this._checkSetup);
		}}
          >
            ${tn.map((e) => E`<option .value=${e} ?selected=${e === this._checkSetup}>${e}</option>`)}
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
      </div>
      <div class="row">
        ${e ? E`<button
              @click=${() => {
			this._check?.stop();
		}}
            >
              Stop
            </button>` : E`<button
              class="primary"
              @click=${() => void this.runCheck({
			setup: this._checkSetup,
			soakMinutes: this._checkSession ? 60 : 0
		})}
            >
              Run playback check
            </button>`}
        <button ?disabled=${!this._checkText} @click=${() => void this._copy(this._checkText)}>Copy report</button>
        <button @click=${() => void this._loadReports()}>Saved reports</button>
      </div>
      ${this._checkText ? E`<pre class="report">${this._checkText}</pre>` : O}
      ${this._reports ? E`<ul class="reports">
            ${this._reports.length ? this._reports.map((e) => E`<li>
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
                  </li>`) : E`<li class="muted">No saved reports</li>`}
          </ul>` : O}
    </div>`;
	}
	_renderToolbar() {
		let e = In(this._view.span);
		return E`<div class="toolbar">
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
        <span class="small muted zoom">${ii(this._view.span)}</span>
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
        <label class="small speed"
          >Speed
          <select
            aria-label="Playback speed"
            @change=${(e) => {
			this._setRate(Number(e.target.value));
		}}
          >
            ${wr.map((e) => E`<option .value=${String(e)} ?selected=${e === this._rate}>${e}×</option>`)}
          </select></label
        >
        ${this._playing ? E`<a class="button" href=${this._playing.clip_url} download>Download clip</a>` : O}
      </div>
    </div>`;
	}
	_renderFilters() {
		let e = Qn(this._day?.events ?? []);
		return e.length ? E`<div class="chips" role="group" aria-label="Event types">
      ${e.map((e) => {
			let t = !this._hidden.has(e);
			return E`<button
          class="chip ${t ? "on" : ""}"
          aria-pressed=${t ? "true" : "false"}
          style="--chip: ${Xn(e)}"
          @click=${() => {
				let n = new Set(this._hidden);
				t ? n.add(e) : n.delete(e), this._hidden = n;
			}}
        >
          <span class="swatch"></span>${Zn(e)}
          <span class="muted">${this._day?.events.filter((t) => t.types.includes(e)).length ?? 0}</span>
        </button>`;
		})}
    </div>` : O;
	}
	_renderHover() {
		let e = this._hover;
		return e ? E`<div class="hover" style="left: ${Math.max(0, e.x - 80)}px">
      ${e.gap ? O : e.url ? E`<img src=${e.url} alt="" />` : E`<div class="noimg"></div>`}
      <span>${X(e.time, this._zone, !0)}${e.gap ? " · no recording" : ""}</span>
    </div>` : O;
	}
	_renderDebug() {
		let e = this._metrics, t = (e) => e === void 0 ? "–" : `${Math.round(e)} ms`, n = e.timelineServer;
		return E`<details class="debug">
      <summary class="small muted">Debug</summary>
      <dl class="facts">
        <dt>Time to timeline</dt>
        <dd>
          ${t(e.timelineMs)}
          ${n ? E`<span class="muted">(server: ${n.cache ?? "?"}${n.search_ms === void 0 ? "" : `, search ${Math.round(n.search_ms)} ms`})</span>` : O}
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
        <dd>${e.cache ? Qr(e.cache) : "–"}</dd>
        <dt>HD</dt>
        <dd>${this._hd.reason}</dd>
        <dt>Delivery</dt>
        <dd>
          ${e.delivery ?? (this._progressive ? "progressive" : "whole file first (WebKit)")}${this._playing?.file ? ` · ${this._playing.file} file` : ""}
        </dd>
        <dt>Player</dt>
        <dd>
          ${Xr(this._player)}
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
		return E`
      <div class="layout">
        <div class="main">
          <rv-player
            .rate=${this._rate}
            .note=${this._note}
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
			this._onPlayerError(e.detail);
		}}
          ></rv-player>
          <div class="dayline">
            <button class="text" aria-label="Previous day" @click=${() => {
			this._changeDay(-1);
		}}>‹</button>
            <strong>${e ? sr(e.start + 432e5, t) : this._date}</strong>
            <button
              class="text"
              aria-label="Next day"
              ?disabled=${this._date >= this._today}
              @click=${() => {
			this._changeDay(1);
		}}
            >›</button>
            <span class="muted small">
              ${this._cursor === void 0 ? "" : X(this._cursor, t, !0)}
              ${this._loading ? " · loading…" : ""}
            </span>
          </div>
          ${this._error ? E`<div class="banner error" role="alert">Could not load recordings: ${this._error}</div>` : O}
          ${this._playFailure ? E`<div class="banner error" role="alert">Playback failed: ${this._playFailure}</div>` : O}
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
          ${e && !e.segments.length && !this._loading ? E`<p class="muted">No recordings on this day.</p>` : O}
          ${this._renderDebug()}
        </div>
        <div class="side">
          <rv-calendar
            .year=${this._month.year}
            .month=${this._month.month}
            .days=${this._monthDays}
            .selected=${this._date}
            .today=${this._today}
            .firstDay=${dr(this.hass?.locale?.language)}
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
			this._cursor = e.detail.event.start, this._day && (this._view = Ln(this._view, e.detail.event.start, this._day)), this.playAt(e.detail.event.start);
		}}
            @rv-thumbs-needed=${(e) => void this._loadThumbs(e.detail.times)}
          ></rv-event-list>
        </div>
      </div>
    `;
	}
	static styles = [N, o`
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
}, Jr = (e) => new Promise((t) => {
	setTimeout(t, e);
}), Yr = (e) => `${Math.round(e / 1e6)} MB`;
function Xr(e) {
	let t = e?.mseStats;
	return t ? [
		t.api,
		t.mime.replace(/^video\/mp4; codecs=/, ""),
		`${t.windows} windows, ${(t.bytes / 1e6).toFixed(1)} MB${t.lastWaitMs === void 0 ? "" : `, last in ${Math.round(t.lastWaitMs)} ms`}`,
		`${Math.round(t.ahead)} s ahead, ${Math.round(t.behind)} s behind`,
		`${t.trims} trims`
	].join(" · ") : e?.current ? "file player" : "–";
}
function Zr(e, t, n) {
	return n ? "cached file (Range)" : e ? "progressive" : t ? "whole file first (to seek)" : "whole file first (WebKit)";
}
function Qr(e) {
	let t = `${(e.bytes / 1e6).toFixed(1)} MB`;
	return e.error ? `failed: ${e.error}` : e.complete ? `cached (${t})` : `filling (${t} so far)`;
}
function $r() {
	try {
		let e = window.localStorage.getItem(Wr);
		if (e && tn.includes(e)) return e;
	} catch {}
	return /iPhone|iPad/.test(navigator.userAgent) ? "iPhone app, Wi-Fi (local)" : "Desktop Chrome, LAN";
}
function ei() {
	try {
		return window.localStorage.getItem(Gr) === "file" ? "file" : "auto";
	} catch {
		return "auto";
	}
}
function ti(e) {
	try {
		window.localStorage.setItem(Gr, e);
	} catch {}
}
function ni(e) {
	try {
		window.localStorage.setItem(Wr, e);
	} catch {}
}
async function ri(e) {
	let t = navigator.clipboard;
	try {
		if (window.isSecureContext && t) return await t.writeText(e), !0;
	} catch {}
	let n = document.createElement("textarea");
	n.value = e, n.setAttribute("readonly", ""), n.style.cssText = "position:fixed;top:0;left:0;opacity:0", document.body.append(n), n.select(), n.setSelectionRange(0, e.length);
	try {
		return document.execCommand("copy");
	} catch {
		return !1;
	} finally {
		n.remove();
	}
}
function ii(e) {
	return e >= 36e5 ? `${Math.round(e / 36e5)} h` : `${Math.round(e / G)} min`;
}
customElements.get("rv-playback") || customElements.define("rv-playback", qr);
//#endregion
//#region src/components/device-page.ts
var ai = 1e3, oi = class extends j {
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
		return e.size === 1 && e.has("hass") && this._renderedStates !== void 0 ? ct(this._renderedStates, this.hass?.states, this._watched) : !0;
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
			let [e, r] = await Promise.all([Fe(t, this.deviceId), Le(t)]);
			if (n !== this._loadSeq) return;
			this._catalog = r, this._device = e, this._error = void 0, this._watched = ui(e);
		} catch (e) {
			if (n !== this._loadSeq) return;
			this._error = M(e).message;
		}
	}
	_subscribeRegistry(e) {
		this._unsubRegistry = e.connection.subscribeEvents((e) => {
			let t = e.data?.entity_id;
			(!t || this._device?.connections.some((e) => e.entities.some((e) => e.entity_id === t))) && (clearTimeout(this._reloadTimer), this._reloadTimer = setTimeout(() => void this.reload(), ai));
		}, "entity_registry_updated").catch(() => void 0);
	}
	render() {
		this.renderCount += 1;
		let e = this._device, t = e?.node;
		return E`
      <div class="header">
        <button class="text back" @click=${() => {
			P(this, { view: "list" });
		}} aria-label="Back to all devices">← All devices</button>
      </div>
      ${this._error ? E`<div class="banner error" role="alert">Could not load the device: ${this._error}</div>` : O}
      ${t ? E`<div class="title">
              <h2>${t.name ?? "Reolink device"}</h2>
              <span class="badge">${Ze(t.kind)}</span>
              ${t.kind === "camera" && t.connections.length > 1 ? E`<span class="badge" title="In Home Assistant via the NVR and directly"
                    >${t.connections.length} connections</span
                  >` : O}
              <span class="muted small">${t.model ?? ""}</span>
            </div>
            <div class="tabs" role="tablist">
              ${li(e).map((e) => E`<button
                  role="tab"
                  aria-selected=${this.tab === e ? "true" : "false"}
                  class=${this.tab === e ? "active" : ""}
                  @click=${() => {
			P(this, {
				view: "device",
				id: this.deviceId,
				tab: e
			});
		}}
                >
                  ${si[e]}
                </button>`)}
            </div>
            ${e.degraded ? E`<div class="banner warning small">
                  Degraded mode: the Reolink integration's internals changed, so device details are
                  missing. Settings still work.
                </div>` : O}
            ${this.tab === "playback" && ci(e) ? E`<rv-playback
                  .hass=${this.hass}
                  .deviceId=${t.id}
                  .cameraName=${t.name ?? ""}
                ></rv-playback>` : this.tab === "overview" || this.tab === "playback" ? E`<rv-overview .hass=${this.hass} .device=${e}></rv-overview>` : E`<rv-settings
                  .hass=${this.hass}
                  .device=${e}
                  .catalog=${this._catalog}
                  @rv-entity-enabled=${() => void this.reload()}
                ></rv-settings>`}` : this._error ? O : E`<p class="muted">Loading…</p>`}
    `;
	}
	static styles = [N, o`
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
}, si = {
	overview: "Overview",
	playback: "Playback",
	settings: "Settings"
};
function ci(e) {
	return e.node.kind === "camera" && e.node.connections.some((e) => e.playback_source);
}
function li(e) {
	return ci(e) ? [
		"overview",
		"playback",
		"settings"
	] : ["overview", "settings"];
}
function ui(e) {
	let t = e.connections.flatMap((e) => e.entities.map((e) => e.entity_id));
	return e.node.kind === "camera" && e.node.snapshot_entity_id && t.push(e.node.snapshot_entity_id), t;
}
customElements.get("rv-device-page") || customElements.define("rv-device-page", oi);
//#endregion
//#region src/download.ts
function di(e, t, n = document) {
	let r = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), i = URL.createObjectURL(r), a = n.createElement("a");
	a.href = i, a.download = t, a.rel = "noopener", n.body.appendChild(a), a.click(), a.remove(), setTimeout(() => {
		URL.revokeObjectURL(i);
	}, 1e3);
}
//#endregion
//#region src/reolink-viewer-panel.ts
var fi = 6e3, pi = class extends j {
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
		this._route = at(window.location.hash);
	};
	constructor() {
		super(), this.narrow = !1, this._probe = { status: "idle" }, this._includeBattery = !1, this._concurrency = !1, this._maxStreams = 4, this._playback = !1, this._playbackOnly = !1, this._playbackConcurrency = !1, this._playbackStreams = 4, this._copied = !1, this._route = { view: "list" }, this.addEventListener(nt, (e) => {
			this.navigate(e.detail);
		}), this.addEventListener(rt, (e) => {
			this.showToast(e.detail);
		});
	}
	connectedCallback() {
		super.connectedCallback(), this._route = at(window.location.hash), window.addEventListener("hashchange", this._onHashChange);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), window.removeEventListener("hashchange", this._onHashChange), clearTimeout(this._toastTimer), this._run?.cancel(), this._run = void 0;
	}
	updated(e) {
		e.has("hass") && this.hass && !this._devices && !this._loading && (this._load(), Le(this.hass).catch(() => void 0));
	}
	navigate(e) {
		let t = it(e);
		if (window.location.hash !== t) {
			let e = `${window.location.pathname}${window.location.search}${t}`;
			window.history.pushState(null, "", e);
		}
		e.view === "list" && this._route.view === "device" && this._load(), this._route = e;
	}
	showToast(e) {
		clearTimeout(this._toastTimer), this._toast = e, this._toastTimer = setTimeout(() => {
			this._toast = void 0;
		}, fi);
	}
	async _load() {
		if (this.hass) {
			this._loading = !0;
			try {
				this._devices = await Pe(this.hass), this._loadError = void 0, !this._warmed && !this._devices.degraded && (this._warmed = !0, He(this.hass).catch(() => void 0));
			} catch (e) {
				this._loadError = M(e).message;
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
		return E`
      <div class="toolbar">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">Reolink</div>
        ${e.view === "list" ? E`<button class="text" @click=${() => void this._load()} ?disabled=${this._loading}>
              Refresh
            </button>` : O}
      </div>
      <main>
        ${e.view === "device" ? E`<rv-device-page
              .hass=${this.hass}
              .deviceId=${e.id}
              .tab=${e.tab}
            ></rv-device-page>` : E`${this._renderBanner()}
              ${this._loadError ? O : E`<rv-device-list .devices=${this._devices}></rv-device-list>`}
              ${this._isAdmin ? this._renderProbe() : O}`}
      </main>
      ${this._toast ? E`<div class="toast ${this._toast.kind}" role="status" aria-live="polite">
            <span>${this._toast.message}</span>
            <button class="text" aria-label="Dismiss" @click=${() => {
			this._toast = void 0;
		}}>✕</button>
          </div>` : O}
    `;
	}
	_renderBanner() {
		if (this._loadError) return E`<div class="banner error" role="alert">
        Could not load devices: ${this._loadError}
      </div>`;
		let e = this._devices;
		return e?.degraded ? E`<div class="banner warning" role="alert">
      <strong>Degraded mode.</strong> The Reolink integration's internals changed in this
      Home Assistant release, so only the device registry's information is shown, duplicate
      cameras are not merged and the probe is disabled. Settings still work.
      <ul>
        ${e.compat.errors.map((e) => E`<li>${e}</li>`)}
      </ul>
    </div>` : O;
	}
	_renderProbe() {
		let e = this._probe.status === "running", t = e || !this._devices || this._devices.degraded;
		return E`<section class="card">
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
		].map((e) => E`<option value=${e} ?selected=${e === this._maxStreams}>${e}</option>`)}
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
		].map((e) => E`<option value=${e} ?selected=${e === this._playbackStreams}>${e}</option>`)}
        </select>
        recordings at once, one per camera, stopping at the first failure
      </label>
      <div class="actions">
        ${e ? E`<button @click=${() => {
			this._cancelProbe();
		}}>
              Cancel
            </button>` : E`<button class="primary" ?disabled=${t} @click=${() => {
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
			case "idle": return O;
			case "running": return E`<div class="progress" aria-live="polite">
          <p>Probing… this can take several minutes on an NVR.</p>
          <ol class="log">
            ${e.log.map((e) => E`<li>${e}</li>`)}
          </ol>
        </div>`;
			case "error": return E`<div class="banner error" role="alert">Probe failed: ${e.message}</div>`;
			case "done": return E`<div class="done">
          <p>
            Done. The report was saved as <code>${e.filename}</code>. If your browser or
            the Companion app blocked the download, use Copy JSON instead.
          </p>
          <div class="actions">
            <button @click=${() => {
				di(e.report, e.filename);
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
		let t = ze(this.hass, {
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
			let n = tt(/* @__PURE__ */ new Date());
			this._probe = {
				status: "done",
				report: e,
				filename: n
			}, di(e, n);
		}, (e) => {
			this._run === t && (this._run = void 0, this._probe = {
				status: "error",
				message: M(e).message
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
	static styles = [N, o`
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
customElements.get("reolink-viewer-panel") || customElements.define("reolink-viewer-panel", pi);
//#endregion
export { pi as ReolinkViewerPanel };
