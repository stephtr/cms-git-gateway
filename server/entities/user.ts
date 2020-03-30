import { Entity, Column, PrimaryColumn, ManyToMany } from 'typeorm';
import { Site } from './site';

@Entity()
export class User {
	@PrimaryColumn()
	id: string = '';

	@Column()
	name: string = '';

	@Column()
	email: string = '';

	@Column()
	isAdmin: boolean = false;

	@ManyToMany(() => Site, (site) => site.editors)
	sites?: Site[];
}
