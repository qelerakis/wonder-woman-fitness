/**
 * Database Seed Script
 *
 * Creates:
 * - 1 Owner account (Nikolina)
 * - 1 Trainer (Stefani Pavlovska)
 * - 2 Members (Jelena Paunovikj, Ангела Величковска Спасовска) — both TRIAL
 * - 6 Recurring slots (Mon/Wed/Fri 9AM + 6PM)
 * - Sessions for the current week with trainer/member assignments
 */

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { addDays, startOfWeek, subHours, setHours, setMinutes } from "date-fns";

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
      name: "Nikolina",
      phone: "+38970123456",
      role: "OWNER",
      status: "ACTIVE",
      joinDate: new Date("2025-01-01"),
    },
  });
  console.log(`  Owner: ${owner.name} (${owner.email})`);

  // ─── 2. Trainer ─────────────────────────────────────────────────
  const trainerHash = await bcrypt.hash("Trainer123!", SALT_ROUNDS);
  const trainer = await prisma.user.create({
    data: {
      email: "stefanipavlovska4@gmail.com",
      passwordHash: trainerHash,
      name: "Stefani Pavlovska",
      phone: "078402400",
      role: "TRAINER",
      status: "ACTIVE",
      joinDate: new Date(),
    },
  });
  console.log(`  Trainer: ${trainer.name} (${trainer.email})`);

  // ─── 3. Members ────────────────────────────────────────────────
  const memberHash = await bcrypt.hash("Member123!", SALT_ROUNDS);
  const now = new Date();

  const member1 = await prisma.user.create({
    data: {
      email: "jelenapaunovic2728@gmail.com",
      passwordHash: memberHash,
      name: "Jelena Paunovikj",
      phone: "078330817",
      role: "MEMBER",
      status: "TRIAL",
      joinDate: now,
      trialEndsAt: addDays(now, 14),
    },
  });

  const member2 = await prisma.user.create({
    data: {
      email: "angelavspasovska@gmail.com",
      passwordHash: memberHash,
      name: "Ангела Величковска Спасовска",
      phone: "+38977981969",
      role: "MEMBER",
      status: "TRIAL",
      joinDate: now,
      trialEndsAt: addDays(now, 14),
    },
  });

  console.log(`  Members: ${member1.name} (trial), ${member2.name} (trial)`);

  // ─── 4. Recurring Slots (Mon/Wed/Fri 9AM + 6PM) ──────────────
  const slots = await Promise.all([
    prisma.recurringSlot.create({ data: { dayOfWeek: 1, startHour: 9 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 1, startHour: 18 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 3, startHour: 9 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 3, startHour: 18 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 5, startHour: 9 } }),
    prisma.recurringSlot.create({ data: { dayOfWeek: 5, startHour: 18 } }),
  ]);
  console.log(`  Recurring slots: ${slots.length} created`);

  // ─── 5. Sessions for current week ─────────────────────────────
  const weekMonday = startOfWeek(now, { weekStartsOn: 1 });
  const members = [member1, member2];

  const sessions = await Promise.all(
    slots.map(async (slot: { id: string; dayOfWeek: number; startHour: number }, index: number) => {
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

      // Assign trainer to all sessions
      await prisma.sessionTrainer.create({
        data: {
          sessionId: session.id,
          userId: trainer.id,
        },
      });

      // Assign both members to all sessions
      await prisma.sessionMember.createMany({
        data: members.map((member) => ({
          sessionId: session.id,
          userId: member.id,
        })),
      });

      return session;
    })
  );
  console.log(`  Sessions: ${sessions.length} created for current week`);

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
