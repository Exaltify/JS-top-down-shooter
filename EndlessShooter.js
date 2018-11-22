var game = new Phaser.Game(1600, 960, Phaser.CANVAS, 'gameFrame');
var difficulty = 0;
var UI;
var debug = false;

// -------------------------------- Game States

var mainState = {

    preload: function () {
        game.canvas.id = 'canvas';
        game.scale.pageAlignHorizontally = true;
        game.scale.pageAlignVertically = true;
        game.scale.refresh();

        preloadMusic();
        map.preload();
        player.preload();
        enemies.preload();
        setUI('load');

    },


    create: function () {
        game.physics.startSystem(Phaser.Physics.ARCADE);

        createMusic();
        map.create();
        player.create();
        enemies.create();
        setUI('create');

    },

    update: function () {
        player.update();
        enemies.update();
        growDifficulty();
        setUI('update');
    }
}

game.state.add('mainState', mainState);
game.state.start('mainState');

// -------------------------------- map

var map = {

    // load tilemap and tiles associated
    preload: function () {
        game.load.tilemap('map', 'assets/images/map/map.json', null, Phaser.Tilemap.TILED_JSON);
        game.load.image('tiles', 'assets/images/map/map_tileset.png');
    },
    // create layers, set world bounds, enable collision and pathfinder
    create: function () {
        this.tilemap = game.add.tilemap('map');
        this.tilemap.addTilesetImage('tilesheet_complete', 'tiles');
        this.layerTerrain = this.tilemap.createLayer('Terrain');
        this.layerOmbresTerrain = this.tilemap.createLayer('Ombres Terrain');
        this.layerObject1 = this.tilemap.createLayer('Objects1');
        this.layerObjectCollision = this.tilemap.createLayer('collisionObjects1');
        this.layerObject2 = this.tilemap.createLayer('Objects2');
        game.world.setBounds(0, 0, 3200, 1920);
        this.tilemap.setCollisionBetween(1, 1000, true, this.layerObjectCollision);
        this.pathfinder = game.plugins.add(Phaser.Plugin.PathFinderPlugin);
        this.pathfinder.setGrid(this.tilemap.layers[3].data, [-1]);
    }
}


// -------------------------------- player 

var player = {

    //preload player atlas (same sprite with different weapons and dead sprite) and the call preload of weapons
    preload: function () {
        game.load.atlas('playerSpritesheet', '/assets/images/player/playerSpritesheet.png', '/assets/images/player/playerSpritesheet.json', Phaser.Loader.TEXTURE_ATLAS_JSON_ARRAY);
        this.weapons.preload();
    },

    // create sprite and enable physics and collision then calls create of weapons
    create: function () {
        this.sprite = game.add.sprite(800, 550, 'playerSpritesheet');
        game.physics.arcade.enable(this.sprite);
        this.sprite.anchor.set(0.5);
        this.sprite.body.collideWorldBounds = true;

        // set attributes, keyboard inputs (moving) and camera follow
        this.sprite.setHealth(this.sprite.maxHealth);
        this.sprite.data.speed = 200;
        this.sprite.data.activeWeaponId = 0;
        this.keyInputs = {
            up: game.input.keyboard.addKey(Phaser.Keyboard.Z),
            down: game.input.keyboard.addKey(Phaser.Keyboard.S),
            left: game.input.keyboard.addKey(Phaser.Keyboard.Q),
            right: game.input.keyboard.addKey(Phaser.Keyboard.D),
            switch: game.input.keyboard.addKey(Phaser.Keyboard.C)
        };
        this.keyInputs.switch.onDown.add(this.switchWeapon, this);
        game.camera.follow(this.sprite);
        this.weapons.create();
    },

    // on every game loop, check collisions, rotate the sprite to face the pointer, and move then calls update of weapons
    update: function () {
        if (!this.sprite.alive) return;
        game.physics.arcade.collide(this.sprite, map.layerObjectCollision, null, null, this);
        game.physics.arcade.collide(this.sprite, enemies.zombies.group, this.collisionEnemy, null, this);
        game.physics.arcade.collide(this.sprite, enemies.dogs.group, this.collisionEnemy, null, this);
        game.physics.arcade.collide(this.sprite, enemies.marines.group, this.collisionEnemy, null, this);
        this.sprite.rotation = game.physics.arcade.angleToPointer(this.sprite);
        this.move();
        if (this.weapons != null) this.weapons.update();
    },

    collisionEnemy: function (entity, enemy) {
        if (game.time.now > enemy.data.damageTimer) {
            this.sprite.damage(enemy.data.damage);
            enemy.data.damageTimer = game.time.now + 1000;
        }
        if (!this.sprite.alive) this.die();
    },

    die: function () {
        if (this.weapons != null) {
            this.weapons.gun.weapon.destroy();
            this.weapons.rifle.weapon.destroy();
            this.weapons = null;
        }
        this.sprite.kill();
        this.sprite.visible = true;
        this.sprite.frameName = 'player_dead';
        this.sprite.body.allowRotation = false;
        this.rotation = 0;
    },

    move: function () {
        // does nothing if sprite is dead
        if (!this.sprite.alive) return;

        // set velocity on x and y to 0
        this.sprite.body.velocity.set(0);

        var dist = this.sprite.data.speed / Math.sqrt(2);

        // check inputs from user 
        var up = this.keyInputs.up.isDown, left = this.keyInputs.left.isDown, down = this.keyInputs.down.isDown, right = this.keyInputs.right.isDown;

        // handle movement in 8 directions (by increasing velocity and not directly change sprite coordinates)
        if (left && up) this.sprite.body.velocity.set(-dist, -dist);

        else if (left && down) this.sprite.body.velocity.set(-dist, dist);

        else if (right && up) this.sprite.body.velocity.set(dist, -dist);

        else if (right && down) this.sprite.body.velocity.set(dist, dist);

        else if (right) this.sprite.body.velocity.x = this.sprite.data.speed;

        else if (left) this.sprite.body.velocity.x = -this.sprite.data.speed;

        else if (up) this.sprite.body.velocity.y = -this.sprite.data.speed;

        else if (down) this.sprite.body.velocity.y = this.sprite.data.speed;

    },

    switchWeapon: function () {
        if (!this.sprite.alive) return;
        this.sprite.data.activeWeaponId = (this.sprite.data.activeWeaponId + 1) % 3;
        switch (this.sprite.data.activeWeaponId) {
            case 0:
                this.sprite.frameName = 'player_gun';
                break;
            case 1:
                this.sprite.frameName = 'player_rifle';
                break;
            case 2:
                this.sprite.frameName = 'player_phaser';
        }
    },

    // -------------------------------- weapons is nested in player

    weapons: {

        // call every weapon.preload 
        preload: function () {
            this.gun.preload();
            this.rifle.preload();
            this.phaser.preload();
        },

        // call every weapon.create
        create: function () {
            this.fireButton = game.input.activePointer;
            this.gun.create();
            this.rifle.create();
            this.phaser.create();
        },

        // call every weapon.update on each loop
        update: function () {
            this.phaser.stopBeam();
            this.gun.update();
            this.rifle.update();
            this.phaser.update();
        },

        bulletCollisionMap: function (bullet) {
            bullet.kill();
        },

        bulletCollisionEnemy: function (bullet, enemy) {
            enemy.damage(bullet.parent.damage);
            bullet.kill();
            if (!enemy.alive) {
                enemy.data.healthBar.sprite.destroy();
                enemy.data = null;
                /*       score++;
                       scoreText.text = "Zombies tués :" + score;              */ // A REFAIRE
            }
        },

        gun: {

            // load bullet sprite
            preload: function () {
                game.load.image('bullet_gun', '/assets/images/objects/projectiles/bullet_gun.png');
            },

            create: function () {
                this.weapon = game.add.weapon(100, 'bullet_gun');
                this.weapon.trackSprite(player.sprite, 26, 10, true);
                this.weapon.bulletSpeed = 450;
                this.id = 0;
                this.weapon.bullets.damage = 20;
                this.weapon.fireRate = 200;
            },

            // if this is the active weapon, fire
            update: function () {
                if (!this.weapon.active || player.sprite.data.activeWeaponId != this.id) return;
                if (player.weapons.fireButton.isDown) this.weapon.fire();
                game.physics.arcade.collide(this.weapon.bullets, map.layerObjectCollision, player.weapons.bulletCollisionMap, null, this);
                game.physics.arcade.overlap(this.weapon.bullets, enemies.zombies.group, player.weapons.bulletCollisionEnemy, null, this);
                game.physics.arcade.overlap(this.weapon.bullets, enemies.dogs.group, player.weapons.bulletCollisionEnemy, null, this);
                game.physics.arcade.overlap(this.weapon.bullets, enemies.marines.group, player.weapons.bulletCollisionEnemy, null, this);
            }
        },

        rifle: {

            // load bullet sprite
            preload: function () {
                game.load.image('bullet_rifle', '/assets/images/objects/projectiles/bullet_rifle.png');
            },

            create: function () {
                this.weapon = game.add.weapon(1000, 'bullet_rifle');
                this.weapon.trackSprite(player.sprite, 26, 10, true);
                this.weapon.bulletSpeed = 450;
                //      this.weapon.fireLimit = 200;
                this.weapon.bullets.damage = 20;
                this.weapon.fireRate = 70;
                this.weapon.bulletAngleVariance = 15;
                this.id = 1;
            },

            // if this is the active weapon, fire
            update: function () {
                if (!this.weapon.active || player.sprite.data.activeWeaponId != this.id) return;
                if (player.weapons.fireButton.isDown) this.weapon.fire();
                game.physics.arcade.collide(this.weapon.bullets, map.layerObjectCollision, player.weapons.bulletCollisionMap, null, this);
                game.physics.arcade.overlap(this.weapon.bullets, enemies.zombies.group, player.weapons.bulletCollisionEnemy, null, this);
                game.physics.arcade.overlap(this.weapon.bullets, enemies.dogs.group, player.weapons.bulletCollisionEnemy, null, this);
                game.physics.arcade.overlap(this.weapon.bullets, enemies.marines.group, player.weapons.bulletCollisionEnemy, null, this);
            },
        },

        phaser: {
            // load bullet sprite
            preload: function () {
                game.load.image('bullet_phaser', '/assets/images/objects/projectiles/bullet_phaser.png');
            },

            create: function () {
                this.weapon = game.add.weapon(10000, 'bullet_phaser');
                this.weapon.trackSprite(player.sprite, 20, 6, true);
                this.weapon.bulletSpeed = 500;
                this.weapon.bulletKillType = Phaser.Weapon.KILL_DISTANCE;
                this.weapon.bulletKillDistance = 300;
                //    this.weapon.fireLimit = 200;
                this.weapon.bullets.damage = 2;
                this.weapon.fireRate = 16;
                this.id = 2;
            },

            // if this is the active weapon, fire
            update: function () {
                if (!this.weapon.active || player.sprite.data.activeWeaponId != this.id) return;
                if (player.weapons.fireButton.isDown) this.weapon.fire();
                var test = game.physics.arcade.collide(this.weapon.bullets, map.layerObjectCollision, player.weapons.bulletCollisionMap, null, this);
                game.physics.arcade.overlap(this.weapon.bullets, enemies.zombies.group, this.bulletCollisionEnemyPhaser, null, this);
                game.physics.arcade.overlap(this.weapon.bullets, enemies.dogs.group, this.bulletCollisionEnemyPhaser, null, this);
                game.physics.arcade.overlap(this.weapon.bullets, enemies.marines.group, this.bulletCollisionEnemyPhaser, null, this);
            },

            bulletCollisionEnemyPhaser(bullet, enemy) {
                enemy.damage(bullet.parent.damage);
                if (!enemy.alive) {
                    enemy.data.healthBar.sprite.destroy();
                    enemy.data = null;
                    /*       score++;
                           scoreText.text = "Zombies tués :" + score;              */ // A REFAIRE
                }
            },

            stopBeam() {
                if (player.weapons.fireButton.isUp) this.weapon.killAll();
            }
        }
    }
}


// -------------------------------- Enemies 

var enemies = {

    preload: function () {
        this.zombies.preload();
        this.dogs.preload();
        this.marines.preload();
    },

    create: function () {
        this.zombies.create();
        this.dogs.create();
        this.marines.create();
    },

    update: function () {
        if (debug) {
            this.zombies.update();
        }
        else {
            this.zombies.update();
            this.dogs.update();
            this.marines.update();
        }
    },

    // spawn one entity of given type

    spawn: function (type) {
        switch (type.id) {
            case 0:
                if (game.time.now < type.spawnTimer || type.group.countLiving() >= type.maxLiving) { return; }
                for (var i = 1; i <= type.spawnNumber; i++) {
                    var spawnPosition = randomPosition();
                    var enemy = type.group.create(spawnPosition.x, spawnPosition.y, type.spriteKey);
                    enemy.anchor.setTo(0.5, 0.5);
                    type.spawnTimer = type.updateSpawnTimer();
                    enemy.data.collisionTime = game.time.now;
                    enemy.data.pathTime = 0;
                    enemy.maxHealth = type.group.childMaxHealth;
                    enemy.setHealth(enemy.maxHealth);
                    enemy.data.damage = 20;
                    enemy.data.damageTimer = 0;
                    setHealthBar(enemy);
                }
                break;

            case 1:
                if (game.time.now < type.spawnTimer || type.group.countLiving() >= type.maxLiving) { return; }
                for (var i = 1; i <= type.spawnNumber; i++) {
                    var spawnPosition = randomPosition();
                    var enemy = type.group.create(spawnPosition.x, spawnPosition.y, type.spriteKey);
                    enemy.anchor.setTo(0.5, 0.5);
                    type.spawnTimer = type.updateSpawnTimer();
                    enemy.data.collisionTime = game.time.now;
                    enemy.data.pathTime = 0;
                    enemy.maxHealth = type.group.childMaxHealth;
                    enemy.setHealth(enemy.maxHealth);
                    enemy.data.damage = 40;
                    enemy.data.damageTimer = 0;
                    setHealthBar(enemy);
                }
                break;

            case 2:
                if (game.time.now < type.spawnTimer || type.group.countLiving() >= type.maxLiving) { return; }
                for (var i = 1; i <= type.spawnNumber; i++) {
                    var spawnPosition = randomPosition();
                    var enemy = type.group.create(spawnPosition.x, spawnPosition.y, type.spriteKey);
                    enemy.anchor.setTo(0.5, 0.5);
                    type.spawnTimer = type.updateSpawnTimer();
                    enemy.data.collisionTime = game.time.now;
                    enemy.data.pathTime = 0;
                    enemy.maxHealth = type.group.childMaxHealth;
                    enemy.setHealth(enemy.maxHealth);
                    enemy.data.damage = 75;
                    enemy.data.damageTimer = 0;
                    setHealthBar(enemy);
                    enemies.marines.setSprite(enemy);
                }
        }
    },


    // move enemy in player direction, go into path state when blocked. In path state the enemy follow a path to player instead of simply moving toward him
    move: function (enemy) {
        if ((enemy.body.blocked.up || enemy.body.blocked.right || enemy.body.blocked.left || enemy.body.blocked.down)
            || game.time.now < enemy.data.collisionTime) {
            findPathToPlayer(enemy);
            if (enemy.body.blocked.up || enemy.body.blocked.right || enemy.body.blocked.left || enemy.body.blocked.down) {
                enemy.data.collisionTime = game.time.now + 5000;
            }
        }
        else {
            enemy.rotation = game.physics.arcade.moveToObject(enemy, player.sprite, enemy.parent.childSpeed);
        }
    },

    zombies: {

        preload: function () {
            game.load.image('zombie', '/assets/images/enemies/zombie.png');
        },

        // create group and enable physics
        create: function () {
            this.group = game.add.group();
            this.group.enableBody = true;
            this.group.physicsBodyType = Phaser.Physics.ARCADE;
            this.id = 0;
            this.spawnTimer = 0;
            this.spawnNumber = 5;
            this.updateSpawnTimer = function () {
                return game.time.now + 8000;
            }
            this.maxLiving = 30;
            this.group.childMaxHealth = 60;
            this.group.childSpeed = 75;
            this.spriteKey = 'zombie';
        },

        update: function () {
            if (debug) {
                this.spawnNumber = 1;
                this.maxLiving = 1;
                enemies.spawn(this);
            }
            enemies.spawn(this);
            game.physics.arcade.collide(this.group, map.layerObjectCollision, null, null, this);
            game.physics.arcade.collide(this.group, enemies.dogs.group, null, null, this);
            game.physics.arcade.collide(this.group, enemies.marines.group, null, null, this);
            game.physics.arcade.collide(this.group, this.group, null, null, this);
            this.group.forEachExists(enemies.move, this);
            this.group.forEachExists(updateHealthBar, this);
        }
    },

    dogs: {

        preload: function () {
            game.load.image('dog', '/assets/images/enemies/dog.png');
        },

        // create group and enable physics
        create: function () {
            this.group = game.add.group();
            this.group.enableBody = true;
            this.group.physicsBodyType = Phaser.Physics.ARCADE;
            this.id = 1;
            this.spawnTimer = 0;
            this.spawnNumber = 2;
            this.updateSpawnTimer = function () {
                return game.time.now + 12000;
            }
            this.maxLiving = 20;
            this.group.childMaxHealth = 35;
            this.group.childSpeed = 250;
            this.spriteKey = 'dog';
        },

        update: function () {
            if (difficulty >= 10) enemies.spawn(this);
            game.physics.arcade.collide(this.group, map.layerObjectCollision, null, null, this);
            game.physics.arcade.collide(this.group, enemies.zombies.group, null, null, this);
            game.physics.arcade.collide(this.group, enemies.marines.group, null, null, this);
            game.physics.arcade.collide(this.group, this.group, null, null, this);
            this.group.forEachExists(enemies.move, this);
            this.group.forEachExists(updateHealthBar, this);
        }

    },

    marines: {
        preload: function () {
            game.load.atlas('marineSpritesheet', '/assets/images/enemies/marineSpritesheet.png',
                '/assets/images/enemies/marineSpritesheet.json', Phaser.Loader.TEXTURE_ATLAS_JSON_ARRAY);
        },

        // create group and enable physics
        create: function () {
            this.group = game.add.group();
            this.group.enableBody = true;
            this.group.physicsBodyType = Phaser.Physics.ARCADE;
            this.id = 2;
            this.spawnTimer = 0;
            this.spawnNumber = 3;
            this.updateSpawnTimer = function () {
                return game.time.now + 20000;
            }
            this.maxLiving = 30;
            this.group.childMaxHealth = 150;
            this.group.childSpeed = 115;
            this.spriteKey = 'marineSpritesheet';
        },

        update: function () {
            if (difficulty >= 20) enemies.spawn(this);
            game.physics.arcade.collide(this.group, map.layerObjectCollision, null, null, this);
            game.physics.arcade.collide(this.group, enemies.zombies.group, null, null, this);
            game.physics.arcade.collide(this.group, enemies.dogs.group, null, null, this);
            game.physics.arcade.collide(this.group, this.group, null, null, this);
            this.group.forEachExists(enemies.move, this);
            this.group.forEachExists(updateHealthBar, this);
        },

        setSprite: function (marine) {
            var rand = game.rnd.integerInRange(0, 2);
            marine.frameName = "marine" + rand;
        }
    }

}

// -------------------------------- User Interface and Data display

function setHealthBar(entity) {
    entity.data.healthBar = new Array();
    entity.data.healthBar.barProgress = entity.maxHealth;
    entity.data.healthBar.bar = game.add.bitmapData(entity.maxHealth, 4);
    entity.data.healthBar.sprite = game.add.sprite(entity.x - (entity.data.healthBar.bar.width * 0.5), entity.y - 25, entity.data.healthBar.bar);
    game.add.tween(entity).to({ barProgress: 0 }, 2000, null, true, 0, Infinity);
}

function updateHealthBar(entity) {
    entity.data.healthBar.sprite.visible = true;
    if (!entity.data.healthBar.sprite.alive) return;
    entity.data.healthBar.bar.context.clearRect(0, 0, entity.data.healthBar.bar.width, entity.data.healthBar.bar.height);
    if (entity.data.healthBar.barProgress <= Math.floor(entity.parent.childMaxHealth / 3)) {
        entity.data.healthBar.bar.context.fillStyle = '#f00';
    }
    else if (entity.data.healthBar.barProgress <= Math.floor((2 * entity.parent.childMaxHealth) / 3)) {
        entity.data.healthBar.bar.context.fillStyle = '#ff0';
    }
    else {
        entity.data.healthBar.bar.context.fillStyle = '#0f0';
    }
    entity.data.healthBar.bar.context.fillRect(0, 0, entity.data.healthBar.barProgress, 8);
    entity.data.healthBar.bar.dirty = true;
    entity.data.healthBar.sprite.x = entity.x - (entity.data.healthBar.bar.width * 0.5);
    entity.data.healthBar.sprite.y = entity.y - 25;
    entity.data.healthBar.barProgress = entity.health;
    if (checkOverlap(entity.data.healthBar.sprite, UI)) entity.data.healthBar.sprite.visible = false;

}
function setUI(action) {
    switch (action) {
        case 'update':
            UI.data.healthBar.bar.context.clearRect(0, 0, UI.data.healthBar.bar.width, UI.data.healthBar.bar.height);
            if (UI.data.healthBar.barProgress <= Math.floor((player.sprite.maxHealth * 3.14) / 3)) {
                UI.data.healthBar.bar.context.fillStyle = '#f00';
            }
            else if (UI.data.healthBar.barProgress <= 2 * Math.floor((player.sprite.maxHealth * 3.14) / 3)) {
                UI.data.healthBar.bar.context.fillStyle = '#ff0';
            }
            else {
                UI.data.healthBar.bar.context.fillStyle = '#0f0';
            }
            UI.data.healthBar.bar.context.fillRect(0, 0, UI.data.healthBar.barProgress, 17);
            UI.data.healthBar.bar.dirty = true;
            UI.data.healthBar.barProgress = player.sprite.health * 3.14;
            break;
        case 'load':
            game.load.image('UI', '/assets/images/UI/playerUI.png');
            break;
        case 'create':
            UI = game.add.sprite(581, 25, 'UI');
            UI.fixedToCamera = true;
            UI.data.healthBar = new Array();
            UI.data.healthBar.barProgress = player.sprite.maxHealth * 3.14;
            UI.data.healthBar.bar = game.add.bitmapData(player.sprite.maxHealth * 3.14, 17);
            UI.data.healthBar.sprite = game.add.sprite(UI.x + 65, UI.y + 22, UI.data.healthBar.bar);
            UI.data.healthBar.sprite.fixedToCamera = true;
            createTimerUi();
            break;
    }
}

// -------------------------------- Timer

var timeString = '05:00';
var timeText;

function createTimerUi() {
    var style = { fill: "#000000" };
    timeText = game.add.text(UI.x + 186, UI.y + 56.5, timeString, style);
    timeText.fixedToCamera = true;
    var timer = game.time.create();
    timer.repeat(1 * Phaser.Timer.SECOND, 7200, updateTime, this);
    timer.start();
}

function updateTime() {
    var time = 300000 - game.time.now;
    var minutes = Math.floor(time / 60000);
    var seconds = Math.floor((time - minutes * 60000) / 1000);


    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }

    timeString = minutes + ":" + seconds;
    timeText.text = timeString;
}


// -------------------------------- Music/Sounds

function preloadMusic() {
    game.load.audio('music', 'assets/sounds/music.wav');
}

function createMusic() {
    music = game.add.audio('music', 1, true);
    music.play();
}

// -------------------------------- Difficulty growing and scores

function growDifficulty() {
    var time = game.time.now;
    if (time < 60000) return;                   // moins d'une minute
    else if (time < 90000) difficulty = 1;     // à une minute
    else if (time < 180000) difficulty = 10;    // à 1:30
    else if (time < 210000) difficulty = 11;    // à trois minutes
    else if (time < 240000) difficulty = 12;    // à 3:30
    else if (time < 270000) difficulty = 20;    // à 4
    else if (time < 300000) difficulty = 21;    // à 4:30
    else difficulty = 30;                       // à 5
    adaptToDifficulty();
}

function adaptToDifficulty() {
    switch (difficulty) {
        case 0:
            return;
        case 1:
            enemies.zombies.spawnNumber = 10;
            enemies.zombies.updateSpawnTimer = function () {
                return game.time.now + 6500;
            }
            break;
        case 10:
            enemies.dogs.spawnNumber = 4;
            enemies.zombies.spawnNumber = 15;
            enemies.zombies.maxLiving = 50;
            break;
        case 11:
            enemies.dogs.spawnNumber = 5;
            enemies.dogs.updateSpawnTimer = function () {
                return game.time.now + 8000;
            }
            enemies.zombies.updateSpawnTimer = function () {
                return game.time.now + 5000;
            }
            enemies.zombies.maxLiving = 50;
            enemies.dogs.maxLiving = 25;
            break;
        case 12:
            enemies.zombies.spawnNumber = 20;
            break;
        case 20:
            enemies.zombies.updateSpawnTimer = function () {
                return game.time.now + 4000;
            }
            enemies.zombies.spawnNumber = 25;
            enemies.zombies.maxLiving = 70;
            break;
        case 21:
            enemies.marines.spawnNumber = 5;
            enemies.zombies.maxLiving = 85;
            enemies.zombies.spawnNumber = 30;
            break;
        case 30:
            enemies.zombies.maxLiving = 100;
            enemies.zombies.updateSpawnTimer = function () {
                return game.time.now + 3000;
            }
            enemies.marines.updateSpawnTimer = function () {
                return game.time.now + 10000;
            }
            break;
    }
}

// -------------------------------- Pathfinding

function findPathToPlayer(entity) {
    if (game.time.now > entity.data.pathTime) {
        var entityTileX = Math.floor(entity.body.x / 64);
        var entityTileY = Math.floor(entity.body.y / 64);
        var tileX = Math.floor(player.sprite.body.x / 64);
        var tileY = Math.floor(player.sprite.body.y / 64);
        map.pathfinder.setCallbackFunction(function (path) {
            path = path || [];
            goTo(entity, path);
        });
        if (entityTileX < 0) entityTileX = 0;
        if (entityTileY < 0) entityTileY = 0;
        if (tileX > 50) tileX = 50;
        if (tileY > 30) tileY = 30;
        map.pathfinder.preparePathCalculation([entityTileX, entityTileY], [tileX, tileY]);
        map.pathfinder.calculatePath();
        entity.data.pathTime = game.time.now + 500;
    }
}

function goTo(entity, path) {
    if (path.length > 1) {
        var x = path[1].x * 64 + 32;
        var y = path[1].y * 64 + 32;
        entity.rotation = game.physics.arcade.moveToXY(entity, x, y, entity.parent.childSpeed);
    }
}

// -------------------------------- Just useful functions

// give a random position on the edge of the map

function randomPosition() {
    var point = Phaser.Point
    var rand = Math.random();
    if (rand > 0.5) {
        if (Math.random() > 0.5) {
            point.x = 64;
        }
        else {
            point.x = 3136;
        }
        point.y = Math.random() * 1856;
    }
    else {
        point.y = 0;
        if (Math.random() > 0.5) {
            point.y = 64;
        }
        else {
            point.y = 1856;
        }
        point.x = Math.random() * 3136;
    }
    return point;
}

function checkOverlap(box1, box2) {
    if ((box2.x >= box1.x + box1.width)      // trop à droite
        || (box2.x + box2.width <= box1.x) // trop à gauche
        || (box2.y >= box1.y + box1.height) // trop en bas
        || (box2.y + box2.height <= box1.y))  // trop en haut
        return false;
    else
        return true;
}
