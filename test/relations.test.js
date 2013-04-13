// This test written in mocha+should.js
var should = require('./init.js');

var db, Book, Chapter, Author, Reader;

describe('relations', function() {
    before(function(done) {
        db = getSchema();
        Book = db.define('Book', {name: String});
        Chapter = db.define('Chapter', {name: {type: String, index: true}});
        Author = db.define('Author', {name: String});
        Reader = db.define('Reader', {name: String});

        db.automigrate(function() {
            Book.destroyAll(function() {
                Chapter.destroyAll(function() {
                    Author.destroyAll(function() {
                        Reader.destroyAll(done);
                    });
                });
            });
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
            var b = new Book;
            b.chapters.should.be.an.instanceOf(Function);
            b.users.should.be.an.instanceOf(Function);
            b.authors.should.be.an.instanceOf(Function);
            Object.keys((new Chapter).toObject()).should.include('bookId');
            Object.keys((new Author).toObject()).should.include('projectId');

            db.automigrate(done);
        });

        it('can be declared in short form', function(done) {
            Author.hasMany('readers');
            (new Author).readers.should.be.an.instanceOf(Function);
            Object.keys((new Reader).toObject()).should.include('authorId');

            db.autoupdate(done);
        });

        it('should build record on scope', function(done) {
            Book.create(function(err, book) {
                var c = book.chapters.build();
                c.bookId.should.equal(book.id);
                c.save(done);
            });
        });

        it('should create related object(sync mode)', function(done) {
            Book.hasMany(Chapter);
            Chapter.belongsTo(Book);
            Book.create(function(err, book) {
                Chapter.create({bookId: book.id}, function(err, chapter) {
                    var bookFromChapter = chapter.book();
                    bookFromChapter.should.be.an.instanceOf(Book);
                    bookFromChapter.id.should.equal(book.id);
                    done();
                })
            });
        });

        it('should create related object(async mode)', function(done) {
            Book.hasMany(Chapter);
            Chapter.belongsTo(Book);
            Book.create(function(err, book) {
                Chapter.create({bookId: book.id}, function(err, chapter) {
                    chapter.book(function(err, bookFromChapter){
                        bookFromChapter.should.be.an.instanceOf(Book);
                        bookFromChapter.id.should.equal(book.id);
                        done();
                    })
                })
            });
        });

        it('should create record on scope', function(done) {
            Book.create(function(err, book) {
                book.chapters.create(function(err, c) {
                    should.not.exist(err);
                    should.exist(c);
                    c.bookId.should.equal(book.id);
                    done();
                });
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
            Object.keys((new Item).toObject()).should.include('listId');
            (new Item).list.should.be.an.instanceOf(Function);

            // syntax 2 (new)
            Fear.belongsTo('mind');
            Object.keys((new Fear).toObject()).should.include('mindId');
            (new Fear).mind.should.be.an.instanceOf(Function);
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
                            done();
                        });
                    });
                });
            });
        });
    });

    describe('hasAndBelongsToMany', function() {
        var Article, Tag, ArticleTag;
        it('can be declared', function(done) {
            Article = db.define('Article', {title: String});
            Tag = db.define('Tag', {name: String});
            Article.hasAndBelongsToMany('tags');
            ArticleTag = db.models.ArticleTag;
            db.automigrate(function() {
                Article.destroyAll(function() {
                    Tag.destroyAll(function() {
                        ArticleTag.destroyAll(done)
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
                        at.tagId.should.equal(t.id);
                        at.articleId.should.equal(article.id);
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
                    article.tags.remove(tags[0], function(e, at) {
                        should.not.exist(e);
                        article.tags(true, function(e, tags) {
                            tags.should.have.lengthOf(len - 1);
                            done();
                        });
                    });
                });
            });
        });

    });

});
