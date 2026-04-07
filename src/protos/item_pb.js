/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const Item = $root.Item = (() => {

    /**
     * Properties of an Item.
     * @exports IItem
     * @interface IItem
     * @property {string|null} [ItemCode] Item ItemCode
     * @property {string|null} [UOM] Item UOM
     * @property {number|null} [Qty] Item Qty
     * @property {string|null} [RowId] Item RowId
     */

    /**
     * Constructs a new Item.
     * @exports Item
     * @classdesc Represents an Item.
     * @implements IItem
     * @constructor
     * @param {IItem=} [properties] Properties to set
     */
    function Item(properties) {
        if (properties)
            for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Item ItemCode.
     * @member {string} ItemCode
     * @memberof Item
     * @instance
     */
    Item.prototype.ItemCode = "";

    /**
     * Item UOM.
     * @member {string} UOM
     * @memberof Item
     * @instance
     */
    Item.prototype.UOM = "";

    /**
     * Item Qty.
     * @member {number} Qty
     * @memberof Item
     * @instance
     */
    Item.prototype.Qty = 0;

    /**
     * Item RowId.
     * @member {string} RowId
     * @memberof Item
     * @instance
     */
    Item.prototype.RowId = "";

    /**
     * Creates a new Item instance using the specified properties.
     * @function create
     * @memberof Item
     * @static
     * @param {IItem=} [properties] Properties to set
     * @returns {Item} Item instance
     */
    Item.create = function create(properties) {
        return new Item(properties);
    };

    /**
     * Encodes the specified Item message. Does not implicitly {@link Item.verify|verify} messages.
     * @function encode
     * @memberof Item
     * @static
     * @param {IItem} message Item message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Item.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.ItemCode != null && Object.hasOwnProperty.call(message, "ItemCode"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.ItemCode);
        if (message.UOM != null && Object.hasOwnProperty.call(message, "UOM"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.UOM);
        if (message.Qty != null && Object.hasOwnProperty.call(message, "Qty"))
            writer.uint32(/* id 3, wireType 5 =*/29).float(message.Qty);
        if (message.RowId != null && Object.hasOwnProperty.call(message, "RowId"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.RowId);
        return writer;
    };

    /**
     * Encodes the specified Item message, length delimited. Does not implicitly {@link Item.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Item
     * @static
     * @param {IItem} message Item message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Item.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an Item message from the specified reader or buffer.
     * @function decode
     * @memberof Item
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Item} Item
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Item.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        let end = length === undefined ? reader.len : reader.pos + length, message = new $root.Item();
        while (reader.pos < end) {
            let tag = reader.uint32();
            switch (tag >>> 3) {
            case 1: {
                    message.ItemCode = reader.string();
                    break;
                }
            case 2: {
                    message.UOM = reader.string();
                    break;
                }
            case 3: {
                    message.Qty = reader.float();
                    break;
                }
            case 4: {
                    message.RowId = reader.string();
                    break;
                }
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes an Item message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Item
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Item} Item
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Item.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Item message.
     * @function verify
     * @memberof Item
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Item.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.ItemCode != null && message.hasOwnProperty("ItemCode"))
            if (!$util.isString(message.ItemCode))
                return "ItemCode: string expected";
        if (message.UOM != null && message.hasOwnProperty("UOM"))
            if (!$util.isString(message.UOM))
                return "UOM: string expected";
        if (message.Qty != null && message.hasOwnProperty("Qty"))
            if (typeof message.Qty !== "number")
                return "Qty: number expected";
        if (message.RowId != null && message.hasOwnProperty("RowId"))
            if (!$util.isString(message.RowId))
                return "RowId: string expected";
        return null;
    };

    /**
     * Creates an Item message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Item
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Item} Item
     */
    Item.fromObject = function fromObject(object) {
        if (object instanceof $root.Item)
            return object;
        let message = new $root.Item();
        if (object.ItemCode != null)
            message.ItemCode = String(object.ItemCode);
        if (object.UOM != null)
            message.UOM = String(object.UOM);
        if (object.Qty != null)
            message.Qty = Number(object.Qty);
        if (object.RowId != null)
            message.RowId = String(object.RowId);
        return message;
    };

    /**
     * Creates a plain object from an Item message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Item
     * @static
     * @param {Item} message Item
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Item.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        let object = {};
        if (options.defaults) {
            object.ItemCode = "";
            object.UOM = "";
            object.Qty = 0;
            object.RowId = "";
        }
        if (message.ItemCode != null && message.hasOwnProperty("ItemCode"))
            object.ItemCode = message.ItemCode;
        if (message.UOM != null && message.hasOwnProperty("UOM"))
            object.UOM = message.UOM;
        if (message.Qty != null && message.hasOwnProperty("Qty"))
            object.Qty = options.json && !isFinite(message.Qty) ? String(message.Qty) : message.Qty;
        if (message.RowId != null && message.hasOwnProperty("RowId"))
            object.RowId = message.RowId;
        return object;
    };

    /**
     * Converts this Item to JSON.
     * @function toJSON
     * @memberof Item
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Item.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Item
     * @function getTypeUrl
     * @memberof Item
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Item.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Item";
    };

    return Item;
})();

export { $root as default };
