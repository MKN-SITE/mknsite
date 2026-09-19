import { db } from "../db";
import { sql } from "drizzle-orm";

export async function ensureJsaTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`ops_telco_jsa_forms\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`jsa_number\` varchar(100) NOT NULL,
      \`job_number\` varchar(100),
      \`job_title\` varchar(255) NOT NULL,
      \`person_title\` varchar(255),
      \`location\` varchar(255) NOT NULL,
      \`jsa_date\` date NOT NULL,
      \`jsa_type\` varchar(50),
      \`ppe_requirements\` text,
      \`analysed_by\` varchar(160),
      \`analysed_by_badge\` varchar(50),
      \`reviewed_by\` varchar(160),
      \`reviewed_by_badge\` varchar(50),
      \`approved_by\` varchar(160),
      \`approved_by_badge\` varchar(50),
      \`supervisor_name\` varchar(160),
      \`lead_worker_name\` varchar(160),
      \`fpe_elements\` text,
      \`job_permits\` text,
      \`workers\` text,
      \`status\` varchar(50) NOT NULL DEFAULT 'completed',
      \`created_by\` int,
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`ops_telco_jsa_forms_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`ops_telco_jsa_number_unique\` UNIQUE(\`jsa_number\`),
      CONSTRAINT \`ops_telco_jsa_forms_created_by_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`ops_telco_jsa_steps\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`jsa_id\` int NOT NULL,
      \`step_number\` int NOT NULL,
      \`sequence\` int NOT NULL DEFAULT 1,
      \`step_description\` text NOT NULL,
      \`hazard_no\` varchar(50),
      \`hazard_description\` text,
      \`action_no\` varchar(50),
      \`action_description\` text,
      \`observation\` varchar(10),
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`ops_telco_jsa_steps_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`ops_telco_jsa_steps_jsa_id_fk\` FOREIGN KEY (\`jsa_id\`) REFERENCES \`ops_telco_jsa_forms\`(\`id\`) ON DELETE CASCADE
    );
  `);

  await db.execute(sql`ALTER TABLE \`ops_telco_jsa_steps\` MODIFY \`hazard_no\` VARCHAR(100), MODIFY \`action_no\` VARCHAR(100);`);

  console.log("JSA tables successfully checked/created/altered.");
}

if (import.meta.main) {
  ensureJsaTables()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error creating tables:", err);
      process.exit(1);
    });
}
