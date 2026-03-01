/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.Student = (function() {

    /**
     * Properties of a Student.
     * @exports IStudent
     * @interface IStudent
     * @property {string|null} [id] Student id
     * @property {string|null} [lastName] Student lastName
     * @property {string|null} [firstName] Student firstName
     * @property {string|null} [gender] Student gender
     * @property {number|null} [grade] Student grade
     * @property {number|null} [classId] Student classId
     * @property {Student.IStats|null} [stats] Student stats
     * @property {Array.<string>|null} [traits] Student traits
     */

    /**
     * Constructs a new Student.
     * @exports Student
     * @classdesc Represents a Student.
     * @implements IStudent
     * @constructor
     * @param {IStudent=} [properties] Properties to set
     */
    function Student(properties) {
        this.traits = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * Student id.
     * @member {string} id
     * @memberof Student
     * @instance
     */
    Student.prototype.id = "";

    /**
     * Student lastName.
     * @member {string} lastName
     * @memberof Student
     * @instance
     */
    Student.prototype.lastName = "";

    /**
     * Student firstName.
     * @member {string} firstName
     * @memberof Student
     * @instance
     */
    Student.prototype.firstName = "";

    /**
     * Student gender.
     * @member {string} gender
     * @memberof Student
     * @instance
     */
    Student.prototype.gender = "";

    /**
     * Student grade.
     * @member {number} grade
     * @memberof Student
     * @instance
     */
    Student.prototype.grade = 0;

    /**
     * Student classId.
     * @member {number} classId
     * @memberof Student
     * @instance
     */
    Student.prototype.classId = 0;

    /**
     * Student stats.
     * @member {Student.IStats|null|undefined} stats
     * @memberof Student
     * @instance
     */
    Student.prototype.stats = null;

    /**
     * Student traits.
     * @member {Array.<string>} traits
     * @memberof Student
     * @instance
     */
    Student.prototype.traits = $util.emptyArray;

    /**
     * Creates a new Student instance using the specified properties.
     * @function create
     * @memberof Student
     * @static
     * @param {IStudent=} [properties] Properties to set
     * @returns {Student} Student instance
     */
    Student.create = function create(properties) {
        return new Student(properties);
    };

    /**
     * Encodes the specified Student message. Does not implicitly {@link Student.verify|verify} messages.
     * @function encode
     * @memberof Student
     * @static
     * @param {IStudent} message Student message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Student.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.id != null && Object.hasOwnProperty.call(message, "id"))
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
        if (message.lastName != null && Object.hasOwnProperty.call(message, "lastName"))
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.lastName);
        if (message.firstName != null && Object.hasOwnProperty.call(message, "firstName"))
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.firstName);
        if (message.gender != null && Object.hasOwnProperty.call(message, "gender"))
            writer.uint32(/* id 4, wireType 2 =*/34).string(message.gender);
        if (message.grade != null && Object.hasOwnProperty.call(message, "grade"))
            writer.uint32(/* id 5, wireType 0 =*/40).int32(message.grade);
        if (message.classId != null && Object.hasOwnProperty.call(message, "classId"))
            writer.uint32(/* id 6, wireType 0 =*/48).int32(message.classId);
        if (message.stats != null && Object.hasOwnProperty.call(message, "stats"))
            $root.Student.Stats.encode(message.stats, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
        if (message.traits != null && message.traits.length)
            for (var i = 0; i < message.traits.length; ++i)
                writer.uint32(/* id 8, wireType 2 =*/66).string(message.traits[i]);
        return writer;
    };

    /**
     * Encodes the specified Student message, length delimited. Does not implicitly {@link Student.verify|verify} messages.
     * @function encodeDelimited
     * @memberof Student
     * @static
     * @param {IStudent} message Student message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Student.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Student message from the specified reader or buffer.
     * @function decode
     * @memberof Student
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {Student} Student
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Student.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Student();
        while (reader.pos < end) {
            var tag = reader.uint32();
            if (tag === error)
                break;
            switch (tag >>> 3) {
            case 1: {
                    message.id = reader.string();
                    break;
                }
            case 2: {
                    message.lastName = reader.string();
                    break;
                }
            case 3: {
                    message.firstName = reader.string();
                    break;
                }
            case 4: {
                    message.gender = reader.string();
                    break;
                }
            case 5: {
                    message.grade = reader.int32();
                    break;
                }
            case 6: {
                    message.classId = reader.int32();
                    break;
                }
            case 7: {
                    message.stats = $root.Student.Stats.decode(reader, reader.uint32());
                    break;
                }
            case 8: {
                    if (!(message.traits && message.traits.length))
                        message.traits = [];
                    message.traits.push(reader.string());
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
     * Decodes a Student message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof Student
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {Student} Student
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Student.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Student message.
     * @function verify
     * @memberof Student
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Student.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.id != null && message.hasOwnProperty("id"))
            if (!$util.isString(message.id))
                return "id: string expected";
        if (message.lastName != null && message.hasOwnProperty("lastName"))
            if (!$util.isString(message.lastName))
                return "lastName: string expected";
        if (message.firstName != null && message.hasOwnProperty("firstName"))
            if (!$util.isString(message.firstName))
                return "firstName: string expected";
        if (message.gender != null && message.hasOwnProperty("gender"))
            if (!$util.isString(message.gender))
                return "gender: string expected";
        if (message.grade != null && message.hasOwnProperty("grade"))
            if (!$util.isInteger(message.grade))
                return "grade: integer expected";
        if (message.classId != null && message.hasOwnProperty("classId"))
            if (!$util.isInteger(message.classId))
                return "classId: integer expected";
        if (message.stats != null && message.hasOwnProperty("stats")) {
            var error = $root.Student.Stats.verify(message.stats);
            if (error)
                return "stats." + error;
        }
        if (message.traits != null && message.hasOwnProperty("traits")) {
            if (!Array.isArray(message.traits))
                return "traits: array expected";
            for (var i = 0; i < message.traits.length; ++i)
                if (!$util.isString(message.traits[i]))
                    return "traits: string[] expected";
        }
        return null;
    };

    /**
     * Creates a Student message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof Student
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {Student} Student
     */
    Student.fromObject = function fromObject(object) {
        if (object instanceof $root.Student)
            return object;
        var message = new $root.Student();
        if (object.id != null)
            message.id = String(object.id);
        if (object.lastName != null)
            message.lastName = String(object.lastName);
        if (object.firstName != null)
            message.firstName = String(object.firstName);
        if (object.gender != null)
            message.gender = String(object.gender);
        if (object.grade != null)
            message.grade = object.grade | 0;
        if (object.classId != null)
            message.classId = object.classId | 0;
        if (object.stats != null) {
            if (typeof object.stats !== "object")
                throw TypeError(".Student.stats: object expected");
            message.stats = $root.Student.Stats.fromObject(object.stats);
        }
        if (object.traits) {
            if (!Array.isArray(object.traits))
                throw TypeError(".Student.traits: array expected");
            message.traits = [];
            for (var i = 0; i < object.traits.length; ++i)
                message.traits[i] = String(object.traits[i]);
        }
        return message;
    };

    /**
     * Creates a plain object from a Student message. Also converts values to other types if specified.
     * @function toObject
     * @memberof Student
     * @static
     * @param {Student} message Student
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Student.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.traits = [];
        if (options.defaults) {
            object.id = "";
            object.lastName = "";
            object.firstName = "";
            object.gender = "";
            object.grade = 0;
            object.classId = 0;
            object.stats = null;
        }
        if (message.id != null && message.hasOwnProperty("id"))
            object.id = message.id;
        if (message.lastName != null && message.hasOwnProperty("lastName"))
            object.lastName = message.lastName;
        if (message.firstName != null && message.hasOwnProperty("firstName"))
            object.firstName = message.firstName;
        if (message.gender != null && message.hasOwnProperty("gender"))
            object.gender = message.gender;
        if (message.grade != null && message.hasOwnProperty("grade"))
            object.grade = message.grade;
        if (message.classId != null && message.hasOwnProperty("classId"))
            object.classId = message.classId;
        if (message.stats != null && message.hasOwnProperty("stats"))
            object.stats = $root.Student.Stats.toObject(message.stats, options);
        if (message.traits && message.traits.length) {
            object.traits = [];
            for (var j = 0; j < message.traits.length; ++j)
                object.traits[j] = message.traits[j];
        }
        return object;
    };

    /**
     * Converts this Student to JSON.
     * @function toJSON
     * @memberof Student
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Student.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Student
     * @function getTypeUrl
     * @memberof Student
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Student.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/Student";
    };

    Student.Stats = (function() {

        /**
         * Properties of a Stats.
         * @memberof Student
         * @interface IStats
         * @property {number|null} [hp] Stats hp
         * @property {number|null} [mp] Stats mp
         * @property {number|null} [str] Stats str
         * @property {number|null} [vit] Stats vit
         * @property {number|null} [dex] Stats dex
         * @property {number|null} [agi] Stats agi
         * @property {number|null} [int] Stats int
         * @property {number|null} [luk] Stats luk
         */

        /**
         * Constructs a new Stats.
         * @memberof Student
         * @classdesc Represents a Stats.
         * @implements IStats
         * @constructor
         * @param {Student.IStats=} [properties] Properties to set
         */
        function Stats(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Stats hp.
         * @member {number} hp
         * @memberof Student.Stats
         * @instance
         */
        Stats.prototype.hp = 0;

        /**
         * Stats mp.
         * @member {number} mp
         * @memberof Student.Stats
         * @instance
         */
        Stats.prototype.mp = 0;

        /**
         * Stats str.
         * @member {number} str
         * @memberof Student.Stats
         * @instance
         */
        Stats.prototype.str = 0;

        /**
         * Stats vit.
         * @member {number} vit
         * @memberof Student.Stats
         * @instance
         */
        Stats.prototype.vit = 0;

        /**
         * Stats dex.
         * @member {number} dex
         * @memberof Student.Stats
         * @instance
         */
        Stats.prototype.dex = 0;

        /**
         * Stats agi.
         * @member {number} agi
         * @memberof Student.Stats
         * @instance
         */
        Stats.prototype.agi = 0;

        /**
         * Stats int.
         * @member {number} int
         * @memberof Student.Stats
         * @instance
         */
        Stats.prototype.int = 0;

        /**
         * Stats luk.
         * @member {number} luk
         * @memberof Student.Stats
         * @instance
         */
        Stats.prototype.luk = 0;

        /**
         * Creates a new Stats instance using the specified properties.
         * @function create
         * @memberof Student.Stats
         * @static
         * @param {Student.IStats=} [properties] Properties to set
         * @returns {Student.Stats} Stats instance
         */
        Stats.create = function create(properties) {
            return new Stats(properties);
        };

        /**
         * Encodes the specified Stats message. Does not implicitly {@link Student.Stats.verify|verify} messages.
         * @function encode
         * @memberof Student.Stats
         * @static
         * @param {Student.IStats} message Stats message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Stats.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.hp != null && Object.hasOwnProperty.call(message, "hp"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.hp);
            if (message.mp != null && Object.hasOwnProperty.call(message, "mp"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.mp);
            if (message.str != null && Object.hasOwnProperty.call(message, "str"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.str);
            if (message.vit != null && Object.hasOwnProperty.call(message, "vit"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.vit);
            if (message.dex != null && Object.hasOwnProperty.call(message, "dex"))
                writer.uint32(/* id 5, wireType 0 =*/40).int32(message.dex);
            if (message.agi != null && Object.hasOwnProperty.call(message, "agi"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.agi);
            if (message.int != null && Object.hasOwnProperty.call(message, "int"))
                writer.uint32(/* id 7, wireType 0 =*/56).int32(message.int);
            if (message.luk != null && Object.hasOwnProperty.call(message, "luk"))
                writer.uint32(/* id 8, wireType 0 =*/64).int32(message.luk);
            return writer;
        };

        /**
         * Encodes the specified Stats message, length delimited. Does not implicitly {@link Student.Stats.verify|verify} messages.
         * @function encodeDelimited
         * @memberof Student.Stats
         * @static
         * @param {Student.IStats} message Stats message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Stats.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Stats message from the specified reader or buffer.
         * @function decode
         * @memberof Student.Stats
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {Student.Stats} Stats
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Stats.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.Student.Stats();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.hp = reader.int32();
                        break;
                    }
                case 2: {
                        message.mp = reader.int32();
                        break;
                    }
                case 3: {
                        message.str = reader.int32();
                        break;
                    }
                case 4: {
                        message.vit = reader.int32();
                        break;
                    }
                case 5: {
                        message.dex = reader.int32();
                        break;
                    }
                case 6: {
                        message.agi = reader.int32();
                        break;
                    }
                case 7: {
                        message.int = reader.int32();
                        break;
                    }
                case 8: {
                        message.luk = reader.int32();
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
         * Decodes a Stats message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof Student.Stats
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {Student.Stats} Stats
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Stats.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Stats message.
         * @function verify
         * @memberof Student.Stats
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Stats.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.hp != null && message.hasOwnProperty("hp"))
                if (!$util.isInteger(message.hp))
                    return "hp: integer expected";
            if (message.mp != null && message.hasOwnProperty("mp"))
                if (!$util.isInteger(message.mp))
                    return "mp: integer expected";
            if (message.str != null && message.hasOwnProperty("str"))
                if (!$util.isInteger(message.str))
                    return "str: integer expected";
            if (message.vit != null && message.hasOwnProperty("vit"))
                if (!$util.isInteger(message.vit))
                    return "vit: integer expected";
            if (message.dex != null && message.hasOwnProperty("dex"))
                if (!$util.isInteger(message.dex))
                    return "dex: integer expected";
            if (message.agi != null && message.hasOwnProperty("agi"))
                if (!$util.isInteger(message.agi))
                    return "agi: integer expected";
            if (message.int != null && message.hasOwnProperty("int"))
                if (!$util.isInteger(message.int))
                    return "int: integer expected";
            if (message.luk != null && message.hasOwnProperty("luk"))
                if (!$util.isInteger(message.luk))
                    return "luk: integer expected";
            return null;
        };

        /**
         * Creates a Stats message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof Student.Stats
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {Student.Stats} Stats
         */
        Stats.fromObject = function fromObject(object) {
            if (object instanceof $root.Student.Stats)
                return object;
            var message = new $root.Student.Stats();
            if (object.hp != null)
                message.hp = object.hp | 0;
            if (object.mp != null)
                message.mp = object.mp | 0;
            if (object.str != null)
                message.str = object.str | 0;
            if (object.vit != null)
                message.vit = object.vit | 0;
            if (object.dex != null)
                message.dex = object.dex | 0;
            if (object.agi != null)
                message.agi = object.agi | 0;
            if (object.int != null)
                message.int = object.int | 0;
            if (object.luk != null)
                message.luk = object.luk | 0;
            return message;
        };

        /**
         * Creates a plain object from a Stats message. Also converts values to other types if specified.
         * @function toObject
         * @memberof Student.Stats
         * @static
         * @param {Student.Stats} message Stats
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Stats.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.hp = 0;
                object.mp = 0;
                object.str = 0;
                object.vit = 0;
                object.dex = 0;
                object.agi = 0;
                object.int = 0;
                object.luk = 0;
            }
            if (message.hp != null && message.hasOwnProperty("hp"))
                object.hp = message.hp;
            if (message.mp != null && message.hasOwnProperty("mp"))
                object.mp = message.mp;
            if (message.str != null && message.hasOwnProperty("str"))
                object.str = message.str;
            if (message.vit != null && message.hasOwnProperty("vit"))
                object.vit = message.vit;
            if (message.dex != null && message.hasOwnProperty("dex"))
                object.dex = message.dex;
            if (message.agi != null && message.hasOwnProperty("agi"))
                object.agi = message.agi;
            if (message.int != null && message.hasOwnProperty("int"))
                object.int = message.int;
            if (message.luk != null && message.hasOwnProperty("luk"))
                object.luk = message.luk;
            return object;
        };

        /**
         * Converts this Stats to JSON.
         * @function toJSON
         * @memberof Student.Stats
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Stats.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Stats
         * @function getTypeUrl
         * @memberof Student.Stats
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Stats.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/Student.Stats";
        };

        return Stats;
    })();

    return Student;
})();

$root.GameSave = (function() {

    /**
     * Properties of a GameSave.
     * @exports IGameSave
     * @interface IGameSave
     * @property {number|null} [version] GameSave version
     * @property {number|Long|null} [timestamp] GameSave timestamp
     * @property {Array.<IStudent>|null} [students] GameSave students
     */

    /**
     * Constructs a new GameSave.
     * @exports GameSave
     * @classdesc Represents a GameSave.
     * @implements IGameSave
     * @constructor
     * @param {IGameSave=} [properties] Properties to set
     */
    function GameSave(properties) {
        this.students = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * GameSave version.
     * @member {number} version
     * @memberof GameSave
     * @instance
     */
    GameSave.prototype.version = 0;

    /**
     * GameSave timestamp.
     * @member {number|Long} timestamp
     * @memberof GameSave
     * @instance
     */
    GameSave.prototype.timestamp = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

    /**
     * GameSave students.
     * @member {Array.<IStudent>} students
     * @memberof GameSave
     * @instance
     */
    GameSave.prototype.students = $util.emptyArray;

    /**
     * Creates a new GameSave instance using the specified properties.
     * @function create
     * @memberof GameSave
     * @static
     * @param {IGameSave=} [properties] Properties to set
     * @returns {GameSave} GameSave instance
     */
    GameSave.create = function create(properties) {
        return new GameSave(properties);
    };

    /**
     * Encodes the specified GameSave message. Does not implicitly {@link GameSave.verify|verify} messages.
     * @function encode
     * @memberof GameSave
     * @static
     * @param {IGameSave} message GameSave message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GameSave.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.version != null && Object.hasOwnProperty.call(message, "version"))
            writer.uint32(/* id 1, wireType 5 =*/13).float(message.version);
        if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
            writer.uint32(/* id 2, wireType 0 =*/16).int64(message.timestamp);
        if (message.students != null && message.students.length)
            for (var i = 0; i < message.students.length; ++i)
                $root.Student.encode(message.students[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified GameSave message, length delimited. Does not implicitly {@link GameSave.verify|verify} messages.
     * @function encodeDelimited
     * @memberof GameSave
     * @static
     * @param {IGameSave} message GameSave message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GameSave.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GameSave message from the specified reader or buffer.
     * @function decode
     * @memberof GameSave
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {GameSave} GameSave
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GameSave.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.GameSave();
        while (reader.pos < end) {
            var tag = reader.uint32();
            if (tag === error)
                break;
            switch (tag >>> 3) {
            case 1: {
                    message.version = reader.float();
                    break;
                }
            case 2: {
                    message.timestamp = reader.int64();
                    break;
                }
            case 3: {
                    if (!(message.students && message.students.length))
                        message.students = [];
                    message.students.push($root.Student.decode(reader, reader.uint32()));
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
     * Decodes a GameSave message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof GameSave
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {GameSave} GameSave
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GameSave.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GameSave message.
     * @function verify
     * @memberof GameSave
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GameSave.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.version != null && message.hasOwnProperty("version"))
            if (typeof message.version !== "number")
                return "version: number expected";
        if (message.timestamp != null && message.hasOwnProperty("timestamp"))
            if (!$util.isInteger(message.timestamp) && !(message.timestamp && $util.isInteger(message.timestamp.low) && $util.isInteger(message.timestamp.high)))
                return "timestamp: integer|Long expected";
        if (message.students != null && message.hasOwnProperty("students")) {
            if (!Array.isArray(message.students))
                return "students: array expected";
            for (var i = 0; i < message.students.length; ++i) {
                var error = $root.Student.verify(message.students[i]);
                if (error)
                    return "students." + error;
            }
        }
        return null;
    };

    /**
     * Creates a GameSave message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof GameSave
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {GameSave} GameSave
     */
    GameSave.fromObject = function fromObject(object) {
        if (object instanceof $root.GameSave)
            return object;
        var message = new $root.GameSave();
        if (object.version != null)
            message.version = Number(object.version);
        if (object.timestamp != null)
            if ($util.Long)
                (message.timestamp = $util.Long.fromValue(object.timestamp)).unsigned = false;
            else if (typeof object.timestamp === "string")
                message.timestamp = parseInt(object.timestamp, 10);
            else if (typeof object.timestamp === "number")
                message.timestamp = object.timestamp;
            else if (typeof object.timestamp === "object")
                message.timestamp = new $util.LongBits(object.timestamp.low >>> 0, object.timestamp.high >>> 0).toNumber();
        if (object.students) {
            if (!Array.isArray(object.students))
                throw TypeError(".GameSave.students: array expected");
            message.students = [];
            for (var i = 0; i < object.students.length; ++i) {
                if (typeof object.students[i] !== "object")
                    throw TypeError(".GameSave.students: object expected");
                message.students[i] = $root.Student.fromObject(object.students[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a GameSave message. Also converts values to other types if specified.
     * @function toObject
     * @memberof GameSave
     * @static
     * @param {GameSave} message GameSave
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GameSave.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.students = [];
        if (options.defaults) {
            object.version = 0;
            if ($util.Long) {
                var long = new $util.Long(0, 0, false);
                object.timestamp = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
            } else
                object.timestamp = options.longs === String ? "0" : 0;
        }
        if (message.version != null && message.hasOwnProperty("version"))
            object.version = options.json && !isFinite(message.version) ? String(message.version) : message.version;
        if (message.timestamp != null && message.hasOwnProperty("timestamp"))
            if (typeof message.timestamp === "number")
                object.timestamp = options.longs === String ? String(message.timestamp) : message.timestamp;
            else
                object.timestamp = options.longs === String ? $util.Long.prototype.toString.call(message.timestamp) : options.longs === Number ? new $util.LongBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0).toNumber() : message.timestamp;
        if (message.students && message.students.length) {
            object.students = [];
            for (var j = 0; j < message.students.length; ++j)
                object.students[j] = $root.Student.toObject(message.students[j], options);
        }
        return object;
    };

    /**
     * Converts this GameSave to JSON.
     * @function toJSON
     * @memberof GameSave
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GameSave.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GameSave
     * @function getTypeUrl
     * @memberof GameSave
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GameSave.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
            typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/GameSave";
    };

    return GameSave;
})();

module.exports = $root;
