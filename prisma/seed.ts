/**
 * Database Seed Script
 *
 * Creates:
 * - 1 Owner account
 * - 2 Trainers
 * - 5 Members (2 TRIAL, 2 ACTIVE with payments, 1 ACTIVE unpaid)
 * - 6 Recurring slots (Mon/Wed/Fri 9AM + 6PM)
 * - Sessions for the current week
 */

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { addDays, startOfWeek, subDays, subHours, setHours, setMinutes } from "date-fns";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;

async function main(): Promise<void> {
  console.log("Seeding database...");

  // ─── Clean existing data ───────────────────────────────────────
  await prisma.notification.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.sessionMember.deleteMany();
  await prisma.sessionTrainer.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.recurringSlot.deleteMany();
  await prisma.privateSession.deleteMany();
  await prisma.user.deleteMany();

  // ─── 1. Owner ──────────────────────────────────────────────────
  const ownerHash = await bcrypt.hash("Owner123!", SALT_ROUNDS);
  const owner = await prisma.user.create({
    data: {
      email: "owner@wonderwomanfitness.mk",
      passwordHash: ownerHash,
      name: "Diana Prince",
      phone: "+38970123456",
      role: "OWNER",
      status: "ACTIVE",
      joinDate: new Date("2025-01-01"),
    },
  });
  console.log(`  Owner: ${owner.email}`);

  // ─── 2. Trainers ──────────────────────────────────────────────
  const trainerHash = await bcrypt.hash("Trainer123!", SALT_ROUNDS);

  const trainer1 = await prisma.user.create({
    data: {
      email: "elena@wonderwomanfitness.mk",
      passwordHash: trainerHash,
      name: "Elena Petrovic",
      phone: "+38971234567",
      role: "TRAINER",
      status: "ACTIVE",
      joinDate: new Date("2025-02-01"),
    },
  });

  const trainer2 = await prisma.user.create({
    data: {
      email: "marko@wonderwomanfitness.mk",
      passwordHash: trainerHash,
      name: "Marko Stefanovic",
      phone: "+38972345678",
      role: "TRAINER",
      status: "ACTIVE",
      joinDate: new Date("2025-03-01"),
    },
  });
  console.log(`  Trainers: ${trainer1.email}, ${trainer2.email}`);

  // ─── 3. Members ────────────────────────────────────────────────
  const memberHash = await bcrypt.hash("Member123!", SALT_ROUNDS);
  const now = new Date();

  // Trial member 1 — 10 days left
  const trial1 = await prisma.user.create({
    data: {
      email: "ana@example.com",
      passwordHash: memberHash,
      name: "Ana Popovic",
      phone: "+38973456789",
      role: "MEMBER",
      status: "TRIAL",
      joinDate: subDays(now, 4),
      trialEndsAt: addDays(now, 10),
      monthlyRate: 2000,
    },
  });

  // Trial member 2 — 3 days left
  const trial2 = await prisma.user.create({
    data: {
      email: "maja@example.com",
      passwordHash: memberHash,
      name: "Maja Jovanovic",
      phone: "+38974567890",
      role: "MEMBER",
      status: "TRIAL",
      joinDate: subDays(now, 11),
      trialEndsAt: addDays(now, 3),
      monthlyRate: 2000,
    },
  });

  // Active member 1 — paid current month
  const active1 = await prisma.user.create({
    data: {
      email: "stefan@example.com",
      passwordHash: memberHash,
      name: "Stefan Markovic",
      phone: "+38975678901",
      role: "MEMBER",
      status: "ACTIVE",
      joinDate: new Date("2025-06-01"),
      monthlyRate: 2000,
    },
  });

  // Active member 2 — paid current month (discounted)
  const active2 = await prisma.user.create({
    data: {
      email: "ivana@example.com",
      passwordHash: memberHash,
      name: "Ivana Nikolic",
      phone: "+38976789012",
      role: "MEMBER",
      status: "ACTIVE",
      joinDate: new Date("2025-08-01"),
      monthlyRate: 1500,
    },
  });

  // Active member 3 — unpaid (simulate grace period)
  const unpaid = await prisma.user.create({
    data: {
      email: "nikola@example.com",
      passwordHash: memberHash,
      name: "Nikola Dimitrov",
      phone: "+38977890123",
      role: "MEMBER",
      status: "ACTIVE",
      joinDate: new Date("2025-09-01"),
      monthlyRate: 2000,
    },
  });

  console.log(
    `  Members: ${trial1.name} (trial), ${trial2.name} (trial), ` +
      `${active1.name} (active), ${active2.name} (active), ${unpaid.name} (unpaid)`
  );

  // ─── 4. Payments for active members ───────────────────────────
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await prisma.payment.createMany({
    data: [
      {
        userId: active1.id,
        amount: 2000,
        paidAt: addDays(currentMonthStart, 2),
        periodStart: currentMonthStart,
        periodEnd: currentMonthEnd,
        recordedById: owner.id,
        notes: "Monthly payment",
      },
      {
        userId: active2.id,
        amount: 1500,
        paidAt: addDays(currentMonthStart, 1),
        periodStart: currentMonthStart,
        periodEnd: currentMonthEnd,
        recordedById: owner.id,
        notes: "Discounted rate",
      },
    ],
  });
  console.log("  Payments recorded for active members");

  // ─── 5. Recurring Slots (Mon/Wed/Fri 9AM + 6PM) ──────────────
  const slots = await Promise.all([
    prisma.recurringSlot.create({ data: { dayOfWeek: 1, startHour: 9 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 1, startHour: 18 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 3, startHour: 9 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 3, startHour: 18 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 5, startHour: 9 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 5, startHour: 18 } }),
  ]);
  console.log(`  Recurring slots: ${slots.length} created`);

  // ─── 6. Sessions for current week ─────────────────────────────
  // weekDate is always the Monday of the week
  const weekMonday = startOfWeek(now, { weekStartsOn: 1 });

  const allMembers = [trial1, trial2, active1, active2, unpaid];
  const trainers = [trainer1, trainer2];

  const sessions = await Promise.all(
    slots.map(async (slot, index) => {
      const session = await prisma.session.create({
        data: {
          recurringSlotId: slot.id,
          weekDate: weekMonday,
          workoutTitle:
            index < 2
              ? "Upper Body Strength"
              : index < 4
                ? "HIIT Cardio Blast"
                : "Full Body Conditioning",
          workoutDetails:
            index < 2
              ? "Bench press 4x8, Shoulder press 3x10, Pull-ups 3xMax, Lateral raises 3x12"
              : index < 4
                ? "30 seconds on / 15 seconds off: Burpees, Box jumps, Mountain climbers, Kettlebell swings. 4 rounds."
                : "Deadlifts 4x6, Squats 3x10, Lunges 3x12 each, Plank 3x60s",
          votingEnabled: true,
          votingDeadline: subHours(
            setMinutes(setHours(addDays(weekMonday, slot.dayOfWeek - 1), slot.startHour), 0),
            24
          ),
        },
      });

      // Assign a trainer
      const assignedTrainer = trainers[index % trainers.length];
      await prisma.sessionTrainer.create({
        data: {
          sessionId: session.id,
          userId: assignedTrainer.id,
        },
      });

      // Add members to sessions (distribute them)
      const sessionMembers = allMembers.filter(
        (_, memberIndex) => memberIndex % 2 === index % 2 || index < 2
      );
      await prisma.sessionMember.createMany({
        data: sessionMembers.map((member) => ({
          sessionId: session.id,
          userId: member.id,
        })),
      });

      return session;
    })
  );
  console.log(`  Sessions: ${sessions.length} created for current week`);

  // ─── 7. Sample votes ──────────────────────────────────────────
  // Add some votes for the first session
  if (sessions[0]) {
    await prisma.vote.createMany({
      data: [
        { sessionId: sessions[0].id, userId: active1.id, attending: true },
        { sessionId: sessions[0].id, userId: active2.id, attending: true },
        { sessionId: sessions[0].id, userId: trial1.id, attending: false },
      ],
    });
    console.log("  Sample votes added");
  }

  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
