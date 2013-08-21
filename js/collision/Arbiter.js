"use strict";
(function(exports, undefined) {

    var Arbiter = function(bodyA, bodyB) {

        this.bodyA = bodyA;
        this.bodyB = bodyB;
        this.key = bodyA.id + "_" + bodyB.id;

        this.restitution = Math.max(bodyA.restitution, bodyB.restitution);
        this.friction = Math.sqrt(bodyA.friction * bodyB.friction)
        this.sensor = bodyA.sensor || bodyB.sensor;

        this.contacts = [];

        this.solveTick = 0;

        this.first = true;
    };


    var proto = {

        bodyA: null,
        bodyB: null,
        normal: null,

        restitution: 0,
        friction: 0,
        contacts: null,

        sensor: false,

        restitutionVelocity: 1,
        splittingFrame: 3,

        set: function(bodyA, bodyB, normalA) {
            // this.bodyA = bodyA;
            // this.bodyB = bodyB;
            // this.key = bodyA.id + "_" + bodyB.id;
            this.normal = normalA;
            this.tangent = [-normalA[1], normalA[0]];

            // this.restitution = Math.max(bodyA.restitution, bodyB.restitution);
            // this.friction = Math.sqrt(bodyA.friction * bodyB.friction)
            // this.sensor = bodyA.sensor || bodyB.sensor;

            this.contactCount = 0;

            this.lastDataA = this.lastDataB = {};
        },


        addContact: function(contactOnA, contactOnB, depth) {

            var normal = this.normal;
            var tangent = this.tangent;
            var bodyA = this.bodyA,
                bodyB = this.bodyB;

            if (depth === undefined) {
                depth = (contactOnA[0] - contactOnB[0]) * normal[0] + (contactOnA[1] - contactOnB[1]) * normal[1];
            }

            var armA = [contactOnA[0] - bodyA.x, contactOnA[1] - bodyA.y];
            var armB = [contactOnB[0] - bodyB.x, contactOnB[1] - bodyB.y];


            var armACrossN = armA[0] * normal[1] - armA[1] * normal[0];
            armACrossN *= armACrossN;
            var armBCrossN = armB[0] * normal[1] - armB[1] * normal[0];
            armBCrossN *= armBCrossN;


            var armACrossT = armA[0] * tangent[1] - armA[1] * tangent[0];
            armACrossT *= armACrossT;
            var armBCrossT = armB[0] * tangent[1] - armB[1] * tangent[0];
            armBCrossT *= armBCrossT;


            var denom = bodyA.invMass + bodyB.invMass + (armACrossN * bodyA.invInertia) + (armBCrossN * bodyB.invInertia);
            var normalMass = !denom ? 0 : 1 / denom;

            var denom = bodyA.invMass + bodyB.invMass + (armACrossT * bodyA.invInertia) + (armBCrossT * bodyB.invInertia);
            var tangentMass = !denom ? 0 : 1 / denom;

            var denom = bodyA.mass * bodyA.invMass + bodyB.mass * bodyB.invMass + bodyA.mass * bodyA.invInertia * armACrossN + bodyB.mass * bodyB.invInertia * armBCrossN;
            var equalizedMass = !denom ? 0 : 1 / denom;

            var relativeVel = [
                (bodyA.velX - bodyA.velAng * armA[1]) - (bodyB.velX - bodyB.velAng * armB[1]), (bodyA.velY + bodyA.velAng * armA[0]) - (bodyB.velY + bodyB.velAng * armB[0])
            ]
            var normalRelativeVel = relativeVel[0] * normal[0] + relativeVel[1] * normal[1];

            var velocityBias=restitution*normalRelativeVel;

            // var velocityBias = null;

            var contact = {
                contactOnA: contactOnA,
                contactOnB: contactOnB,
                armA: armA,
                armB: armB,
                depth: depth,
                normalMass: normalMass,
                tangentMass: tangentMass,
                velocityBias: velocityBias,
                // equalizedMass: equalizedMass,
            }
            var oldCon = this.contacts[this.contactCount];
            if (oldCon) {
                contact.normalImpulse = oldCon.normalImpulse || 0;
                contact.tangentImpulse = oldCon.tangentImpulse || 0;
            } else {
                contact.normalImpulse = 0;
                contact.tangentImpulse = 0;
            }
            this.contacts[this.contactCount] = contact;
            this.contactCount++;
        },

        preSolve: function(timeStep, iterations) {

            if (this.bodyA.bodyType!=BodyType.Static && this.bodyB.bodyType!=BodyType.Static){
                // console.log(this.first);
            }
            this.contacts.length=this.contactCount;
            if (this.first) return;

            var bodyA = this.bodyA;
            var bodyB = this.bodyB;

            var nx = this.normal[0];
            var ny = this.normal[1];
            for (var i = 0; i < this.contactCount; i++) {
                var contact = this.contacts[i];
                var armA = contact.armA,
                    armB = contact.armB;

                var impX = nx * contact.normalImpulse - ny * contact.tangentImpulse;
                var impY = nx * contact.tangentImpulse + ny * contact.normalImpulse;

                // console.log(impX, impY)
                bodyA.velX += (impX * bodyA.invMass);
                bodyA.velY += (impY * bodyA.invMass);
                bodyA.velAng += (armA[0] * impY - armA[1] * impX) * bodyA.invInertia;


                bodyB.velX -= (impX * bodyB.invMass);
                bodyB.velY -= (impY * bodyB.invMass);
                bodyB.velAng -= (armB[0] * impY - armB[1] * impX) * bodyB.invInertia;


            }
            // this.first=true;
        },

        solve: function(timeStep, iterations) {
            var bodyA = this.bodyA,
                bodyB = this.bodyB,
                normal = this.normal,
                tangent = this.tangent;
            var restitution = this.restitution,
                friction = this.friction,
                sensor = this.sensor;

            var lastDataA, lastDataB
            var solved = false;

            var contacts = this.contacts;
            var contactCount = this.contactCount;

            var rvN = null;
            for (var k = 0; k < contactCount; k++) {
                var contact = contacts[k];

                var contactOnA = contact.contactOnA;
                var contactOnB = contact.contactOnB;
                var armA = contact.armA,
                    armB = contact.armB;
                var depth = contact.depth,
                    normalMass = contact.normalMass,
                    tangentMass = contact.tangentMass;

                if (!solved) {
                    solved = true;
                    this.lastDataA = {
                        velX: bodyA.velX,
                        velY: bodyA.velY,
                        velAng: bodyA.velAng,
                    };
                    this.lastDataB = {
                        velX: bodyB.velX,
                        velY: bodyB.velY,
                        velAng: bodyB.velAng,
                    }
                }


                var relativeVel = [
                    (bodyA.velX - bodyA.velAng * armA[1]) - (bodyB.velX - bodyB.velAng * armB[1]), (bodyA.velY + bodyA.velAng * armA[0]) - (bodyB.velY + bodyB.velAng * armB[0])
                ]
                var normalRelativeVel = relativeVel[0] * normal[0] + relativeVel[1] * normal[1];

                if (rvN === null) {
                    rvN = normalRelativeVel;
                }

                if (contact.velocityBias === null) {
                    contact.velocityBias = restitution * rvN;
                }

                // if (depth>0){
                //     // normalRelativeVel+=depth/timeStep;
                //     var dt=timeStep;
                //     var dd=depth/iterations;
                //     normalRelativeVel+=dd/dt;
                    
                // }

                var impN = normalMass * -(normalRelativeVel + contact.velocityBias);
                var normalImpulse = contact.normalImpulse;
                contact.normalImpulse = Math.min(impN + normalImpulse, 0)
                impN = contact.normalImpulse - normalImpulse;


                var tangentRelativeVel = relativeVel[0] * tangent[0] + relativeVel[1] * tangent[1];

                var impT = tangentMass * -tangentRelativeVel;
                var frictionImp = Math.abs(contact.normalImpulse * friction);
                var tangentImpulse = contact.tangentImpulse;
                contact.tangentImpulse = Math.max(-frictionImp, Math.min(impT + tangentImpulse, frictionImp));
                impT = contact.tangentImpulse - tangentImpulse;



                var impX = normal[0] * impN - normal[1] * impT;
                var impY = normal[0] * impT + normal[1] * impN;


                bodyA.velX += (impX * bodyA.invMass);
                bodyA.velY += (impY * bodyA.invMass);
                bodyA.velAng += (armA[0] * impY - armA[1] * impX) * bodyA.invInertia;


                bodyB.velX -= (impX * bodyB.invMass);
                bodyB.velY -= (impY * bodyB.invMass);
                bodyB.velAng -= (armB[0] * impY - armB[1] * impX) * bodyB.invInertia;

                // drawPoly(context, bodyB, "#fff")
                // drawPoly(context, bodyA)
                // drawPoint(context, contactOnB, "#fff")
                // console.log(impY, (armB[0] * impY - armB[1] * impX) * bodyB.invInertia)
                // debugger

            }

            return solved;
        },


    };


    exports.Arbiter = Class(Arbiter, proto);

}(exports));