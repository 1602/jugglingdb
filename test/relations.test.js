// This test written in mocha+should.js
var should = require('./init.js');

var db, Book, Chapter, Author, Reader;

describe('relations', function() {
    before(function(done) {
        db = getSchema();
        Book = db.define('Book', {name: String});
        Chapter = db.define('Chapter', {name: {type: String, index: true, limit: 20}});
        Author = db.define('Author', {name: String});
        Reader = db.define('Reader', {name: String});

        db.automigrate(function() {
            Book.destroyAll().then(function() {
                return Chapter.destroyAll();
            }).then(function() {
                return Author.destroyAll();
            }).then(function() {
                return Reader.destroyAll();
            }).then(done);
        });
    });

    after(function() {
        db.disconnect();
    });

    describe('hasMany', function() {
        it('can be declared in different ways', function(done) {
            Book.hasMany(Chapter);
            Book.hasMany(Reader, {as: 'users'});
            Book.hasMany(Author, {foreignKey: 'projectId'});
            var b = new Book();
            b.chapters.should.be.an.instanceOf(Function);
            b.users.should.be.an.instanceOf(Function);
            b.authors.should.be.an.instanceOf(Function);
            (new Chapter()).toObject().should.have.property('bookId');
            (new Author()).toObject().should.have.property('projectId');

            db.automigrate(done);
        });

        it('can be declared in short form', function(done) {
            Author.hasMany('readers');
            (new Author()).readers.should.be.an.instanceOf(Function);
            (new Reader()).toObject().should.have.property('authorId');

            db.autoupdate(done);
        });

        it('should build record on scope', function(done) {
            Book.create(function(err, book) {
                var c = book.chapters.build();
                c.bookId.should.equal(book.id);
                c.save(done);
            });
        });

        it('should create record on scope', function() {
            var book;
            return Book.create()
                .then(function(book_) {
                    book = book_;
                    return book.chapters.create();
                }).then(function(c) {
                    should.exist(c);
                    c.bookId.should.equal(book.id);
                });
        });

        it.skip('should fetch all scoped instances', function(done) {
            Book.create(function(err, book) {
                book.chapters.create({name: 'a'}, function() {
                    book.chapters.create({name: 'z'}, function() {
                        book.chapters.create({name: 'c'}, function() {
                            fetch(book);
                        });
                    });
                });
            });
            function fetch(book) {
                book.chapters(function(err, ch) {
                    should.not.exist(err);
                    should.exist(ch);
                    ch.should.have.lengthOf(3);

                    book.chapters({order: 'name DESC'}, function(e, c) {
                        should.not.exist(e);
                        should.exist(c);
                        c.shift().name.should.equal('z');
                        c.pop().name.should.equal('a');
                        done();
                    });
                });
            }
        });

        it('should find scoped record', function(done) {
            var id;
            Book.create(function(err, book) {
                book.chapters.create({name: 'a'}, function(err, ch) {
                    id = ch.id;
                    book.chapters.create({name: 'z'}, function() {
                        book.chapters.create({name: 'c'}, function() {
                            fetch(book);
                        });
                    });
                });
            });

            function fetch(book) {
                book.chapters.find(id, function(err, ch) {
                    should.not.exist(err);
                    should.exist(ch);
                    ch.id.should.equal(id);
                    done();
                });
            }
        });

        it('should destroy scoped record', function(done) {
            Book.create(function(err, book) {
                book.chapters.create({name: 'a'}, function(err, ch) {
                    book.chapters.destroy(ch.id, function(err) {
                        should.not.exist(err);
                        book.chapters.find(ch.id, function(err, ch) {
                            should.exist(err);
                            err.message.should.equal('Not found');
                            should.not.exist(ch);
                            done();
                        });
                    });
                });
            });
        });

        it('should not allow destroy not scoped records', function(done) {
            Book.create(function(err, book1) {
                book1.chapters.create({name: 'a'}, function(err, ch) {
                    var id = ch.id;
                    Book.create(function(err, book2) {
                        book2.chapters.destroy(ch.id, function(err) {
                            should.exist(err);
                            err.message.should.equal('Permission denied');
                            book1.chapters.find(ch.id, function(err, ch) {
                                should.not.exist(err);
                                should.exist(ch);
                                ch.id.should.equal(id);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    describe('belongsTo', function() {
        var List, Item, Fear, Mind;

        it('can be declared in different ways', function() {
            List = db.define('List', {name: String});
            Item = db.define('Item', {name: String});
            Fear = db.define('Fear');
            Mind = db.define('Mind');

            // syntax 1 (old)
            Item.belongsTo(List);
            (new Item()).toObject().should.have.property('listId');
            (new Item()).list.should.be.an.instanceOf(Function);

            // syntax 2 (new)
            Fear.belongsTo('mind');
            (new Fear()).toObject().should.have.property('mindId');
            (new Fear()).mind.should.be.an.instanceOf(Function);
            // (new Fear).mind.build().should.be.an.instanceOf(Mind);
        });

        it('can be used to query data', function(done) {
            List.hasMany('todos', {model: Item});
            db.automigrate(function() {
                List.create(function(e, list) {
                    should.not.exist(e);
                    should.exist(list);
                    list.todos.create(function(err, todo) {
                        todo.list(function(e, l) {
                            should.not.exist(e);
                            should.exist(l);
                            l.should.be.an.instanceOf(List);
                            done();
                        });
                    });
                });
            });
        });

        it('can be used to query data as promise', function() {
            List.hasMany('todos', {model: Item});
            return db.automigrate()
                .then(function() {
                    return List.create();
                })
                .then(function(list) {
                    should.exist(list);
                    return list.todos.create();
                })
                .then(function(todo) {
                    return todo.list();
                })
                .then(function(l) {
                    should.exist(l);
                    l.should.be.an.instanceOf(List);
                });
        });

        it('could accept objects when creating on scope', function(done) {
            List.create(function(e, list) {
                should.not.exist(e);
                should.exist(list);
                Item.create({list: list}, function(err, item) {
                    should.not.exist(err);
                    should.exist(item);
                    should.exist(item.listId);
                    item.listId.should.equal(list.id);
                    item.__cachedRelations.list.should.equal(list);
                    done();
                });
            });
        });

    });

    describe('hasAndBelongsToMany', function() {
        var Article, Tag, ArticleTag;

        before(function(done) {
            Article = db.define('Article', {title: String});
            Tag = db.define('Tag', {name: String});
            Article.hasAndBelongsToMany('tags');
            ArticleTag = db.models.ArticleTag;
            db.automigrate(function() {
                Article.destroyAll(function() {
                    Tag.destroyAll(function() {
                        ArticleTag.destroyAll(done);
                    });
                });
            });
        });

        it('should allow to create instances on scope', function(done) {
            Article.create(function(e, article) {
                article.tags.create({name: 'popular'}, function(e, t) {
                    t.should.be.an.instanceOf(Tag);
                    ArticleTag.findOne(function(e, at) {
                        should.exist(at);
                        at.tagId.toString().should.equal(t.id.toString());
                        at.articleId.toString().should.equal(article.id.toString());
                        done();
                    });
                });
            });
        });

        it('should allow to fetch scoped instances', function(done) {
            Article.findOne(function(e, article) {
                article.tags(function(e, tags) {
                    should.not.exist(e);
                    should.exist(tags);
                    done();
                });
            });
        });

        it('should allow to add connection with instance', function(done) {
            Article.findOne(function(e, article) {
                Tag.create({name: 'awesome'}, function(e, tag) {
                    article.tags.add(tag, function(e, at) {
                        should.not.exist(e);
                        should.exist(at);
                        at.should.be.an.instanceOf(ArticleTag);
                        at.tagId.should.equal(tag.id);
                        at.articleId.should.equal(article.id);
                        done();
                    });
                });
            });
        });

        it('should allow to remove connection with instance', function(done) {
            Article.findOne(function(e, article) {
                article.tags(function(e, tags) {
                    var len = tags.length;
                    tags.should.not.be.empty;
                    should.exist(tags[0]);
                    article.tags.remove(tags[0], function(e) {
                        if (e) {
                            console.log(e.stack);
                        }
                        should.not.exist(e);
                        article.tags(true, function(e, tags) {
                            tags.should.have.lengthOf(len - 1);
                            done();
                        });
                    });
                });
            });
        });

        it('should remove the correct connection', function() {
            var article1, article2, tag;
            return Article.create({title: 'Article 1'})
                .then(function(article1_) {
                    article1 = article1_;
                    return Article.create({title: 'Article 2'});
                })
                .then(function(article2_) {
                    article2 = article2_;
                    return Tag.create({name: 'correct'});
                })
                .then(function(tag_) {
                    tag = tag_;
                    return article1.tags.add(tag);
                })
                .then(function() {
                    return article2.tags.add(tag);
                })
                .then(function() {
                    return article2.tags();
                })
                .then(function(tags) {
                    tags.should.have.lengthOf(1);
                    return article2.tags.remove(tag);
                })
                .then(function() {
                    delete article2.__cachedRelations.tags;
                    return article2.tags();
                })
                .then(function(tags) {
                    tags.should.have.lengthOf(0);
                    return article1.tags();
                })
                .then(function(tags) {
                    tags.should.have.lengthOf(1);
                });
        });

    });

});
